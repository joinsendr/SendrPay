import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  ChevronRight, Check, Loader2, Landmark, Zap, ArrowLeftRight, Shield, Copy, ExternalLink, RefreshCw, Wallet, AlertTriangle,
} from "lucide-react";
import { Modal } from "./Modal";
import { useWallet } from "../context/WalletContext";
import { getDepositAddress, stellarExplorerUrl, type DepositAddressInfo, type LedgerEntry } from "../lib/api";
import {
  DEPOSIT_CURRENCIES, CURRENCY_SYMBOL, MOCK_USDC_RATE, FUNDING_OPTIONS,
  type DepositCurrency, type FundingOption, type FundingIcon,
} from "../data/depositData";
import { connectWallet, disconnectWallet, getWalletUsdcStatus, sendUsdcPayment, USDC_ISSUER, type WalletUsdcStatus } from "../lib/walletKit";

type Step = "currency" | "amount" | "funding" | "processing" | "success" | "receiveUsdc" | "connectWallet";

const STEP_TITLE: Record<Step, string> = {
  currency: "Add Balance",
  amount: "Deposit amount",
  funding: "Fund with",
  processing: "Processing deposit",
  success: "Add Balance",
  receiveUsdc: "USDC on Stellar",
  connectWallet: "Pay from your wallet",
};

function truncateAddress(addr: string): string {
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-6)}` : addr;
}

const OPTION_ICON: Record<FundingIcon, React.ElementType> = {
  bank: Landmark,
  instant: Zap,
  wise: ArrowLeftRight,
  plaid: Shield,
};

const initialState = {
  step: "currency" as Step,
  currency: null as DepositCurrency | null,
  amount: "",
  option: null as FundingOption | null,
  creditedUsdc: 0,
};

// Polls the backend (which in turn checks real Stellar testnet payment
// operations) every few seconds while the receive screen is open, so a
// deposit sent from an external wallet shows up without the user having to
// manually refresh. The backend also polls independently on its own
// schedule (EventBridge, every 1 min), so a deposit is detected even if no
// one has this screen open.
const POLL_INTERVAL_MS = 4000;

export function AddBalanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { fundSimulated, checkForDeposits } = useWallet();
  const [state, setState] = useState(initialState);
  const [addressCopied, setAddressCopied] = useState(false);
  const [depositInfo, setDepositInfo] = useState<DepositAddressInfo | null>(null);
  const [addressError, setAddressError] = useState("");
  const [justDetected, setJustDetected] = useState<LedgerEntry | null>(null);
  const [checking, setChecking] = useState(false);
  const { step, currency, amount, option, creditedUsdc } = state;

  // Browser wallet connect (Freighter/xBull/Albedo/Rabet/etc.) state — lets
  // someone fund the wallet by signing directly from their own Stellar
  // testnet wallet, instead of only being able to paste the address into an
  // external app.
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletStatus, setWalletStatus] = useState<WalletUsdcStatus | null>(null);
  const [walletPhase, setWalletPhase] = useState<"idle" | "connecting" | "loadingBalance" | "sending" | "sent" | "error">("idle");
  const [walletError, setWalletError] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sentTxHash, setSentTxHash] = useState<string | null>(null);

  const reset = () => setState(initialState);
  const close = () => {
    onClose();
    window.setTimeout(() => {
      reset();
      setJustDetected(null);
      setWalletAddress(null);
      setWalletStatus(null);
      setWalletPhase("idle");
      setWalletError("");
      setSendAmount("");
      setSentTxHash(null);
    }, 200);
  };

  const goBack = () => {
    if (step === "amount") setState((s) => ({ ...s, step: "currency" }));
    else if (step === "funding") setState((s) => ({ ...s, step: "amount" }));
    else if (step === "receiveUsdc") setState((s) => ({ ...s, step: "currency" }));
    else if (step === "connectWallet") setState((s) => ({ ...s, step: "receiveUsdc" }));
  };

  const handleConnectWallet = async () => {
    setWalletPhase("connecting");
    setWalletError("");
    try {
      const address = await connectWallet();
      setWalletAddress(address);
      setWalletPhase("loadingBalance");
      const status = await getWalletUsdcStatus(address);
      setWalletStatus(status);
      setWalletPhase("idle");
    } catch (e) {
      setWalletPhase("error");
      setWalletError(e instanceof Error ? e.message : "Couldn't connect to a wallet");
    }
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnectWallet();
    } catch {
      // non-critical — we still clear local state below
    }
    setWalletAddress(null);
    setWalletStatus(null);
    setWalletPhase("idle");
    setWalletError("");
    setSendAmount("");
  };

  const handleSendFromWallet = async () => {
    if (!walletAddress || !depositInfo) return;
    const amt = parseFloat(sendAmount);
    if (!(amt > 0)) return;
    setWalletPhase("sending");
    setWalletError("");
    try {
      const hash = await sendUsdcPayment(walletAddress, depositInfo.address, sendAmount);
      setSentTxHash(hash);
      setWalletPhase("sent");
      // Nudge the backend to pick this up immediately instead of waiting
      // for the next ~1-minute scheduled poll.
      checkForDeposits().catch(() => {});
    } catch (e) {
      setWalletPhase("error");
      setWalletError(e instanceof Error ? e.message : "Transaction failed or was rejected");
    }
  };

  // Load the real deposit address + asset/issuer/network info once, when
  // the receive screen is first opened.
  useEffect(() => {
    if ((step !== "receiveUsdc" && step !== "connectWallet") || depositInfo || addressError) return;
    getDepositAddress()
      .then(setDepositInfo)
      .catch((e) => setAddressError(e.message ?? "Could not load the deposit address"));
  }, [step, depositInfo, addressError]);

  // Auto-poll for new deposits while the receive screen (or the connect-
  // wallet screen, which can also produce a real deposit) is open.
  useEffect(() => {
    if ((step !== "receiveUsdc" && step !== "connectWallet") || !depositInfo) return;
    let cancelled = false;

    const poll = async () => {
      setChecking(true);
      try {
        const result = await checkForDeposits();
        if (cancelled) return;
        const freshDeposit = result.newlyCredited.find((e) => e.type === "stellar_deposit");
        if (freshDeposit) setJustDetected(freshDeposit);
      } catch {
        // transient network/API hiccup — next poll tick will retry
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    poll();
    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [step, depositInfo, checkForDeposits]);

  const copyAddress = async () => {
    if (!depositInfo) return;
    try {
      await navigator.clipboard.writeText(depositInfo.address);
      setAddressCopied(true);
      window.setTimeout(() => setAddressCopied(false), 1500);
    } catch {
      // clipboard unavailable — non-critical for a demo prototype
    }
  };

  const selectCurrency = (c: DepositCurrency) => setState((s) => ({ ...s, currency: c, step: "amount" }));

  const selectOption = async (opt: FundingOption) => {
    if (!currency) return;
    const amt = parseFloat(amount);
    setState((s) => ({ ...s, option: opt, step: "processing" }));
    try {
      const entry = await fundSimulated(amt, currency, opt.label);
      setState((s) => ({ ...s, creditedUsdc: entry.amountUsdc, step: "success" }));
    } catch {
      setState((s) => ({ ...s, step: "funding" }));
    }
  };

  const previewUsdc = currency && parseFloat(amount) > 0 ? parseFloat(amount) * MOCK_USDC_RATE[currency] : null;

  return (
    <Modal
      open={open}
      onClose={close}
      onBack={step === "amount" || step === "funding" || step === "receiveUsdc" ? goBack : undefined}
      title={STEP_TITLE[step]}
    >
      {step === "currency" && (
        <div>
          <p className="mb-2 text-sm text-neutral-500">Fund directly on-chain:</p>
          <button
            type="button"
            onClick={() => setState((s) => ({ ...s, step: "receiveUsdc" }))}
            className="mb-4 flex w-full items-center justify-between rounded-xl border border-neutral-900 px-4 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-bold text-white">
                $
              </span>
              <span>
                USDC on Stellar
                <span className="block text-xs font-normal text-neutral-400">Real testnet deposit, verified on-chain</span>
              </span>
            </span>
            <ChevronRight className="h-4 w-4 text-neutral-300" />
          </button>

          <p className="mb-2 text-sm text-neutral-500">Or fund with:</p>
          <div className="space-y-1.5">
            {DEPOSIT_CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => selectCurrency(c)}
                className="flex w-full items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
              >
                <span className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600">
                    {CURRENCY_SYMBOL[c]}
                  </span>
                  {c}
                </span>
                <ChevronRight className="h-4 w-4 text-neutral-300" />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "receiveUsdc" && (
        <div className="flex flex-col items-center py-2 text-center">
          <span className="mb-4 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-500">
            {depositInfo ? `${depositInfo.network === "TESTNET" ? "Stellar Testnet" : depositInfo.network}` : "Stellar Testnet"}
          </span>

          {addressError ? (
            <div className="py-6">
              <p className="text-sm font-medium text-neutral-900">Couldn't load the deposit address</p>
              <p className="mt-1.5 max-w-[20rem] text-sm text-neutral-500">{addressError}</p>
            </div>
          ) : !depositInfo ? (
            <div className="flex flex-col items-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : justDetected ? (
            <>
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900">
                <Check className="h-6 w-6 text-white" />
              </span>
              <p className="text-sm font-semibold text-neutral-900">Deposit confirmed</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
                +{justDetected.amountUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-base font-semibold text-neutral-400">USDC</span>
              </p>
              <p className="mt-1 text-xs text-neutral-400">Verified from actual Stellar testnet transaction data.</p>
              {justDetected.txHash && (
                <a
                  href={stellarExplorerUrl(justDetected.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
                >
                  View transaction
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </>
          ) : (
            <>
              <div className="mb-4 rounded-2xl border border-neutral-200 p-3">
                <QRCodeSVG value={depositInfo.address} size={176} />
              </div>
              <p className="mb-1.5 text-xs text-neutral-400">Your Sendr Pay USDC address</p>
              <button
                type="button"
                onClick={copyAddress}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
              >
                {truncateAddress(depositInfo.address)}
                <Copy className="h-3.5 w-3.5" />
              </button>
              {addressCopied && <p className="mt-1.5 text-xs text-neutral-400">Copied</p>}

              <dl className="mt-4 w-full space-y-1.5 rounded-xl border border-neutral-100 bg-neutral-50 p-3 text-left text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-neutral-400">Asset</dt>
                  <dd className="font-mono font-medium text-neutral-900">{depositInfo.asset.code}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0 text-neutral-400">Issuer</dt>
                  <dd className="truncate font-mono font-medium text-neutral-900">{truncateAddress(depositInfo.asset.issuer)}</dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Awaiting deposit — checking automatically
              </div>

              <p className="mt-3 max-w-[20rem] text-xs text-neutral-400">
                Only send USDC issued by the address above, on Stellar Testnet, to this address. Any other asset or network may result in permanent loss.
              </p>
              <p className="mt-2 text-[11px] font-medium text-neutral-300">Testnet only — for testing, not real funds.</p>

              <button
                type="button"
                onClick={() => setState((s) => ({ ...s, step: "connectWallet" }))}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
              >
                <Wallet className="h-4 w-4" />
                Or connect your wallet to pay directly
              </button>
            </>
          )}

          <button
            type="button"
            onClick={close}
            className="mt-5 h-11 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Done
          </button>
        </div>
      )}

      {step === "connectWallet" && (
        <div className="flex flex-col items-center py-2 text-center">
          <span className="mb-4 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-500">
            Stellar Testnet
          </span>

          {justDetected ? (
            <>
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900">
                <Check className="h-6 w-6 text-white" />
              </span>
              <p className="text-sm font-semibold text-neutral-900">Deposit confirmed</p>
              <p className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
                +{justDetected.amountUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-base font-semibold text-neutral-400">USDC</span>
              </p>
              <p className="mt-1 text-xs text-neutral-400">Verified from actual Stellar testnet transaction data.</p>
              {justDetected.txHash && (
                <a
                  href={stellarExplorerUrl(justDetected.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
                >
                  View transaction
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </>
          ) : walletPhase === "sent" && sentTxHash ? (
            <>
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-neutral-900" />
              <p className="text-sm font-semibold text-neutral-900">Payment sent — confirming on-chain…</p>
              <p className="mt-1 text-xs text-neutral-400">Usually picked up within a few seconds.</p>
              <a
                href={stellarExplorerUrl(sentTxHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
              >
                View transaction
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </>
          ) : !walletAddress ? (
            <>
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100">
                <Wallet className="h-6 w-6 text-neutral-500" />
              </span>
              <p className="text-sm font-semibold text-neutral-900">Connect a Stellar testnet wallet</p>
              <p className="mt-1.5 max-w-[20rem] text-xs text-neutral-400">
                Freighter, xBull, Albedo, Rabet, Lobstr, and others are supported. You'll approve the payment in your wallet — Sendr Pay never sees your secret key.
              </p>
              {walletPhase === "error" && (
                <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {walletError}
                </p>
              )}
              <button
                type="button"
                onClick={handleConnectWallet}
                disabled={walletPhase === "connecting"}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
              >
                {walletPhase === "connecting" && <Loader2 className="h-4 w-4 animate-spin" />}
                {walletPhase === "connecting" ? "Connecting…" : "Connect wallet"}
              </button>
            </>
          ) : (
            <>
              <p className="mb-1 text-xs text-neutral-400">Connected</p>
              <button
                type="button"
                onClick={handleDisconnectWallet}
                className="mb-4 flex items-center gap-1.5 rounded-xl border border-neutral-200 px-3 py-2 font-mono text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
                title="Disconnect"
              >
                {truncateAddress(walletAddress)}
              </button>

              {walletPhase === "loadingBalance" ? (
                <Loader2 className="mb-4 h-5 w-5 animate-spin text-neutral-400" />
              ) : walletStatus && !walletStatus.hasTrustline ? (
                <p className="mb-4 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This wallet has no USDC trustline yet, so it can't hold or send USDC. Add a trustline to issuer {truncateAddress(USDC_ISSUER)} in your wallet first.
                </p>
              ) : walletStatus ? (
                <p className="mb-4 text-xs text-neutral-400">
                  Wallet balance: <span className="font-medium text-neutral-700">{walletStatus.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC</span>
                </p>
              ) : null}

              <div className="flex w-full items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 focus-within:border-neutral-900">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.0000001"
                  placeholder="0.00"
                  value={sendAmount}
                  onChange={(e) => setSendAmount(e.target.value)}
                  className="w-full bg-transparent text-xl font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
                  autoFocus
                />
                <span className="text-sm font-medium text-neutral-400">USDC</span>
              </div>

              {walletPhase === "error" && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {walletError}
                </p>
              )}

              <button
                type="button"
                onClick={handleSendFromWallet}
                disabled={!(parseFloat(sendAmount) > 0) || walletPhase === "sending" || !walletStatus?.hasTrustline}
                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
              >
                {walletPhase === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
                {walletPhase === "sending" ? "Sending…" : "Send USDC"}
              </button>
            </>
          )}

          {!justDetected && (
            <button
              type="button"
              onClick={close}
              className="mt-5 h-11 w-full rounded-2xl border border-neutral-200 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {step === "amount" && currency && (
        <div>
          <label htmlFor="deposit-amount" className="mb-1.5 block text-sm text-neutral-500">
            How much {currency} do you want to deposit?
          </label>
          <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-4 py-3 focus-within:border-neutral-900">
            <span className="text-lg font-semibold text-neutral-400">{CURRENCY_SYMBOL[currency]}</span>
            <input
              id="deposit-amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setState((s) => ({ ...s, amount: e.target.value }))}
              className="w-full bg-transparent text-xl font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
              autoFocus
            />
            <span className="text-sm font-medium text-neutral-400">{currency}</span>
          </div>
          <p className="mt-1.5 h-4 text-xs text-neutral-400">
            {previewUsdc != null && `≈ ${previewUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC · illustrative rate`}
          </p>

          <button
            type="button"
            disabled={!(parseFloat(amount) > 0)}
            onClick={() => setState((s) => ({ ...s, step: "funding" }))}
            className="mt-3 h-11 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Continue
          </button>
        </div>
      )}

      {step === "funding" && currency && (
        <div className="space-y-1.5">
          <p className="mb-2 text-sm text-neutral-500">Available ways to send {currency}:</p>
          {FUNDING_OPTIONS[currency].map((opt) => {
            const Icon = OPTION_ICON[opt.icon];
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => selectOption(opt)}
                className="flex w-full items-center gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-neutral-900">{opt.label}</span>
                  <span className="block text-xs text-neutral-400">{opt.timing}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" />
              </button>
            );
          })}
        </div>
      )}

      {step === "processing" && option && (
        <div className="flex flex-col items-center py-8 text-center">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-neutral-900" />
          <p className="text-sm font-medium text-neutral-900">Processing your deposit via {option.label}…</p>
        </div>
      )}

      {step === "success" && currency && option && (
        <div>
          <div className="flex flex-col items-center py-2 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900">
              <Check className="h-5 w-5 text-white" />
            </span>
            <p className="text-sm font-semibold text-neutral-900">Money added to your wallet</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-neutral-900 tabular-nums">
              +{creditedUsdc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-base font-semibold text-neutral-400">USDC</span>
            </p>
          </div>

          <dl className="mt-4 space-y-2.5 rounded-xl border border-neutral-100 bg-neutral-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Deposited</dt>
              <dd className="font-medium text-neutral-900">
                {CURRENCY_SYMBOL[currency]}{Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-neutral-400">Method</dt>
              <dd className="font-medium text-neutral-900">{option.label}</dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={close}
            className="mt-4 h-11 w-full rounded-2xl bg-neutral-900 text-sm font-semibold text-white transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
          >
            Done
          </button>
        </div>
      )}
    </Modal>
  );
}
