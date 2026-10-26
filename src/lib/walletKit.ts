// Browser wallet connect (Freighter, xBull, Albedo, Rabet, Lobstr, etc.) via
// Stellar Wallets Kit, so a judge/user can fund the Sendr Pay wallet by
// signing a real payment from their own Stellar testnet wallet, instead of
// only being able to send manually from an external app using the QR code.
//
// The kit only ever asks the connected wallet to SIGN a transaction we
// build — it never has access to, and never needs, the user's secret key.
// We build the unsigned transaction, the wallet extension signs it after
// the user approves in its own UI, and we submit the already-signed
// envelope to Horizon ourselves.
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit/sdk";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import {
  Horizon,
  TransactionBuilder,
  Operation,
  Asset,
  Networks,
  BASE_FEE,
} from "@stellar/stellar-sdk";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const USDC_ASSET_CODE = "USDC";
export const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

const server = new Horizon.Server(HORIZON_URL);
const usdcAsset = new Asset(USDC_ASSET_CODE, USDC_ISSUER);

StellarWalletsKit.init({
  modules: defaultModules(),
  network: Networks.TESTNET,
});

export async function connectWallet(): Promise<string> {
  await StellarWalletsKit.authModal();
  const { address } = await StellarWalletsKit.fetchAddress();
  return address;
}

export async function disconnectWallet(): Promise<void> {
  await StellarWalletsKit.disconnect();
}

export async function getConnectedAddress(): Promise<string | null> {
  try {
    const { address } = await StellarWalletsKit.getAddress();
    return address;
  } catch {
    return null;
  }
}

export type DepositAssetCode = "USDC" | "XLM";

export interface WalletAssetStatus {
  hasTrustline: boolean;
  balance: number;
}

// Read-only lookup — safe to call before any signing, used to show the
// connected wallet's current balance of the chosen asset and warn if it has
// no USDC trustline (native XLM never needs one — every account has it).
export async function getWalletAssetStatus(address: string, assetCode: DepositAssetCode): Promise<WalletAssetStatus> {
  const account = await server.loadAccount(address);
  if (assetCode === "XLM") {
    const native = account.balances.find((b) => b.asset_type === "native");
    return { hasTrustline: true, balance: native ? parseFloat(native.balance) : 0 };
  }
  const line = account.balances.find(
    (b) => "asset_code" in b && b.asset_code === USDC_ASSET_CODE && b.asset_issuer === USDC_ISSUER
  );
  if (!line) return { hasTrustline: false, balance: 0 };
  return { hasTrustline: true, balance: parseFloat(line.balance) };
}

// Builds a USDC or native-XLM payment from the connected wallet to our
// deposit address, asks the wallet extension to sign it, then submits the
// signed envelope to Horizon ourselves. Returns the transaction hash.
export async function sendAssetPayment(
  sourceAddress: string,
  destinationAddress: string,
  amount: string,
  assetCode: DepositAssetCode
): Promise<string> {
  const account = await server.loadAccount(sourceAddress);
  const asset = assetCode === "XLM" ? Asset.native() : usdcAsset;
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: destinationAddress,
        asset,
        amount,
      })
    )
    .setTimeout(180)
    .build();

  const { signedTxXdr } = await StellarWalletsKit.signTransaction(tx.toXDR(), {
    address: sourceAddress,
    networkPassphrase: Networks.TESTNET,
  });

  const signedTx = TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET);
  const result = await server.submitTransaction(signedTx);
  return result.hash;
}
