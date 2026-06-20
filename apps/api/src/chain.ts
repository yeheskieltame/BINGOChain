import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";

// Shared Celo public client. Used for read RPC (indexer) and, crucially, for
// signature checks: publicClient.verifyMessage falls back to ERC-1271/6492 so
// MiniPay and other smart-contract wallets authenticate, not just EOAs.
const RPC = process.env.CELO_RPC || "https://forno.celo.org";

export const celoClient = createPublicClient({ chain: celo, transport: http(RPC) });
