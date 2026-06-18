"use client";

import { erc20Abi, maxUint256 } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { BINGO_ADDRESS, CHAIN_ID } from "../lib/bingo";
import { miniPayTx } from "../lib/minipay";

/// Reads the connected wallet's balance + allowance for `token` and exposes an
/// approve() that lets the BingoChain contract pull stakes.
export function useToken(token: `0x${string}`) {
  const { address } = useAccount();

  const balance = useReadContract({
    abi: erc20Abi,
    address: token,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  });

  const allowance = useReadContract({
    abi: erc20Abi,
    address: token,
    functionName: "allowance",
    args: address ? [address, BINGO_ADDRESS] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address },
  });

  const { writeContractAsync, isPending } = useWriteContract();

  function approve() {
    return writeContractAsync({
      abi: erc20Abi,
      address: token,
      functionName: "approve",
      args: [BINGO_ADDRESS, maxUint256],
      chainId: CHAIN_ID,
      ...miniPayTx(),
    } as Parameters<typeof writeContractAsync>[0]);
  }

  return {
    balance: balance.data ?? 0n,
    allowance: allowance.data ?? 0n,
    approve,
    isApproving: isPending,
    refetch: () => {
      balance.refetch();
      allowance.refetch();
    },
  };
}
