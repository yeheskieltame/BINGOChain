"use client";

// Gasless play via ERC-4337 (ZeroDev Kernel account + session keys) on Celo,
// bundled and gas-sponsored by Pimlico (pay-as-you-go; Celo gas is sub-cent, so a
// few dollars sponsors thousands of moves). No game-contract change: the smart
// account is the on-chain player. The owner (the connected wallet) approves a
// SESSION KEY once, scoped to only BingoChain's gameplay functions; that key then
// auto-signs every move with no popup and no gas, the paymaster pays.
//
// Setup: create a Pimlico API key (api.pimlico.io) for Celo, add a little balance
// to its sponsorship paymaster, and set NEXT_PUBLIC_PIMLICO_API_KEY. See aa.README.md.

import { createKernelAccount, createKernelAccountClient, addressToEmptyAccount } from "@zerodev/sdk";
import { getEntryPoint, KERNEL_V3_1 } from "@zerodev/sdk/constants";
import { signerToEcdsaValidator } from "@zerodev/ecdsa-validator";
import { toPermissionValidator, serializePermissionAccount, deserializePermissionAccount } from "@zerodev/permissions";
import { toECDSASigner } from "@zerodev/permissions/signers";
import { toCallPolicy, CallPolicyVersion } from "@zerodev/permissions/policies";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { entryPoint07Address } from "viem/account-abstraction";
import { createPublicClient, http, type Address, type LocalAccount } from "viem";
import { celo, bingoAbi, BINGO_ADDRESS } from "./bingo";

const PIMLICO_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;
const entryPoint = getEntryPoint("0.7");
const kernelVersion = KERNEL_V3_1;

export const aaConfigured = () => !!PIMLICO_KEY;

function pimlicoUrl(): string {
  if (!PIMLICO_KEY) throw new Error("NEXT_PUBLIC_PIMLICO_API_KEY is not set (create a Pimlico key for Celo)");
  return `https://api.pimlico.io/v2/celo/rpc?apikey=${PIMLICO_KEY}`;
}

const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });

// Pimlico bundler + sponsorship paymaster client (single Celo RPC endpoint).
function pimlico() {
  return createPimlicoClient({
    chain: celo,
    transport: http(pimlicoUrl()),
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });
}

// Wrap a Kernel account into a Pimlico-bundled, paymaster-sponsored kernel client.
function kernelClient(account: Awaited<ReturnType<typeof createKernelAccount>>) {
  const paymaster = pimlico();
  return createKernelAccountClient({
    account,
    chain: celo,
    bundlerTransport: http(pimlicoUrl()),
    client: publicClient,
    paymaster,
    userOperation: { estimateFeesPerGas: async () => (await paymaster.getUserOperationGasPrice()).fast },
  });
}

// Session key may only call BingoChain's gameplay functions, never move value.
function gameCallPolicy() {
  const fns = ["commitBoard", "callNumber", "claimBingo", "revealBoard"] as const;
  return toCallPolicy({
    policyVersion: CallPolicyVersion.V0_0_4,
    permissions: fns.map((functionName) => ({ target: BINGO_ADDRESS as Address, valueLimit: 0n, abi: bingoAbi, functionName })),
  });
}

/// Owner-side: the player's Kernel smart account (owned by the connected wallet)
/// + a paymaster-sponsored client. The smart account address is the player.
export async function ownerKernel(owner: LocalAccount) {
  const sudo = await signerToEcdsaValidator(publicClient, { signer: owner, entryPoint, kernelVersion });
  const account = await createKernelAccount(publicClient, { plugins: { sudo }, entryPoint, kernelVersion });
  return { account, client: kernelClient(account) };
}

/// Owner-side: approve a session key (by address) scoped to the game policy. The
/// owner signs once; returns a serialized approval for the session holder.
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
/// signer, returning a paymaster-sponsored client that auto-signs scoped moves.
export async function gameSessionClient(approval: string, sessionSigner: LocalAccount) {
  const ecdsaSigner = await toECDSASigner({ signer: sessionSigner });
  const account = await deserializePermissionAccount(publicClient, entryPoint, kernelVersion, approval, ecdsaSigner);
  return kernelClient(account);
}
