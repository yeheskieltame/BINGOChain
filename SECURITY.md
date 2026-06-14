# Security Policy

BINGOChain holds player stakes in escrow and settles payouts onchain. We take
security seriously and welcome responsible disclosure.

## Scope

- `src/BingoChain.sol` and the contract family under `src/`
- The UUPS upgrade path and `_authorizeUpgrade` authority
- Commit–reveal sealing, winner verification (call-sequence replay), and payout math
- Escrow accounting: stakes, gas reserve, protocol fee, and the pull-payment withdrawal path

Out of scope: deployment keys, the frontend, and third-party dependencies
(report those upstream).

## Reporting a vulnerability

**Do not open a public issue for a vulnerability.** Instead:

- Email the maintainer (see the GitHub profile of `yeheskieltame`), or
- Use GitHub's private **Report a vulnerability** advisory flow on this repository.

Please include: a description, affected contract/function, a proof-of-concept or
Foundry test if possible, and the potential impact.

## What to expect

- Acknowledgement of the report.
- An assessment and, if valid, a fix tracked privately until deployed.
- Credit in the release notes if you wish.

## Trust model & known trade-offs

- **Upgradeability.** The contract is UUPS-upgradeable. Upgrade authority is gated
  to the owner — a Safe multisig (threshold 2) — which is a deliberate centralization
  vector documented in the architecture notes.
- **No onchain randomness.** Numbers are chosen by players in turn, so there is no
  VRF/oracle to attack. Fairness rests on commit–reveal and deterministic verification.
- **Reveal liveness.** A player who refuses to reveal within the window forfeits;
  this is enforced by the timeout/slashing path, not assumed.
