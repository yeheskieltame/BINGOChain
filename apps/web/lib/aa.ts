"use client";

// Industry-standard gasless play via ERC-4337 account abstraction (ZeroDev Kernel
// on Celo, sponsored by a paymaster). No game-contract change: the smart account
// is the on-chain player. The owner (the connected wallet) approves a SESSION KEY
// once, scoped to only BingoChain's gameplay functions; that session key then
// auto-signs every move (callNumber / claimBingo / revealBoard) with no popup and
// no gas, the paymaster picks up the bill.
//
// Setup required (see lib/aa.README): create a ZeroDev project for Celo mainnet,
// enable a gas-sponsorship policy, and set NEXT_PUBLIC_ZERODEV_RPC.

import {
  createKernelAccount,
  createKernelAccountClient,
  createZeroDevPaymasterClient,
  getUserOperationGasPrice,
} from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { toPermissionValidator, serializePermissionAccount, deserializePermissionAccount } from "@zerodev/permissions";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { toCallPolicy, CallPolicyVersion } from "@zerodev/permissions/policies";
import { addressToEmptyAccount } from "@zerodev/sdk";
import { createPublicClient, http, type Address, type LocalAccount } from "viem";
import { celo, bingoAbi, BINGO_ADDRESS } from "./bingo";

const ZERODEV_RPC = process.env.NEXT_PUBLIC_ZERODEV_RPC;
const entryPoint = getEntryPoint("0.7");
const kernelVersion = KERNEL_V3_1;

function rpc(): string {
  if (!ZERODEV_RPC) throw new Error("NEXT_PUBLIC_ZERODEV_RPC is not set (create a ZeroDev project for Celo)");
  return ZERODEV_RPC;
}

export const aaConfigured = () => !!ZERODEV_RPC;

const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });

// Session key may only call BingoChain's gameplay functions, never move value.
function gameCallPolicy() {
  const fns = ["commitBoard", "callNumber", "claimBingo", "revealBoard"] as const;
  return toCallPolicy({
    policyVersion: CallPolicyVersion.V0_0_4,
    permissions: fns.map((functionName) => ({ target: BINGO_ADDRESS as Address, valueLimit: 0n, abi: bingoAbi, functionName })),
  });
}

/// Owner-side: build the player's Kernel smart account from the connected wallet
/// signer + a paymaster-sponsored client. The smart account address is the player.
export async function ownerKernel(owner: LocalAccount) {
  const sudo = await signerToEcdsaValidator(publicClient, { signer: owner, entryPoint, kernelVersion });
  const account = await createKernelAccount(publicClient, { plugins: { sudo }, entryPoint, kernelVersion });
  const paymaster = createZeroDevPaymasterClient({ chain: celo, transport: http(rpc()) });
  const client = createKernelAccountClient({
    account,
    chain: celo,
    bundlerTransport: http(rpc()),
    client: publicClient,
    paymaster: { getPaymasterData: (userOperation) => paymaster.sponsorUserOperation({ userOperation }) },
    userOperation: { estimateFeesPerGas: async ({ bundlerClient }) => getUserOperationGasPrice(bundlerClient) },
  });
  return { account, client };
}

/// Owner-side: approve a session key (by address) scoped to the game policy. The
/// owner signs once; returns a serialized approval to hand to the session holder.
export async function approveGameSession(owner: LocalAccount, sessionKeyAddress: Address): Promise<string> {
  const sudo = await signerToEcdsaValidator(publicClient, { signer: owner, entryPoint, kernelVersion });
  const emptySessionSigner = await toECDSASigner({ signer: addressToEmptyAccount(sessionKeyAddress) });
  const permission = await toPermissionValidator(publicClient, {
    entryPoint,
    kernelVersion,
    signer: emptySessionSigner,
    policies: [gameCallPolicy()],
  });
  const sessionAccount = await createKernelAccount(publicClient, {
    entryPoint,
    kernelVersion,
    plugins: { sudo, regular: permission },
  });
  return serializePermissionAccount(sessionAccount);
}

/// Holder-side: rebuild the session account from the approval + the session key
/// signer, and return a paymaster-sponsored client that auto-signs scoped moves.
export async function gameSessionClient(approval: string, sessionSigner: LocalAccount) {
  const ecdsaSigner = await toECDSASigner({ signer: sessionSigner });
  const account = await deserializePermissionAccount(publicClient, entryPoint, kernelVersion, approval, ecdsaSigner);
  const paymaster = createZeroDevPaymasterClient({ chain: celo, transport: http(rpc()) });
  return createKernelAccountClient({
    account,
    chain: celo,
    bundlerTransport: http(rpc()),
    client: publicClient,
    paymaster: { getPaymasterData: (userOperation) => paymaster.sponsorUserOperation({ userOperation }) },
    userOperation: { estimateFeesPerGas: async ({ bundlerClient }) => getUserOperationGasPrice(bundlerClient) },
  });
}
