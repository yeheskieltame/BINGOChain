# Contributing to BINGOChain

Thanks for your interest. BINGOChain is a Foundry/Solidity project; the contract
is the product, so the bar for changes is high.

## Development setup

The smart contracts live in [`contracts/`](./contracts); the MiniPay frontend will
live in [`apps/web/`](./apps/web).

```bash
# Install Foundry: https://book.getfoundry.sh/getting-started/installation
git clone --recurse-submodules https://github.com/yeheskieltame/BINGOChain
cd BINGOChain/contracts
forge build
forge test -vvv
```

## Before you open a PR

- `forge fmt` — formatting must be clean (`forge fmt --check` runs in CI).
- `forge test -vvv` — all unit, fuzz, and invariant tests pass.
- `forge build --sizes` — no contract exceeds the 24 KB limit.
- Run Slither locally if you touched contract logic (`slither .`).
- Add or update tests for any behavior you change. Untested logic will not be merged.

## Conventions

- Solidity `0.8.24`, optimizer + `via_ir`, OpenZeppelin v5 upgradeable.
- Custom errors over `require` strings.
- Storage changes go **only** by appending to the EIP-7201 `CoreStorage` struct —
  never reorder or retype existing fields (it breaks upgrade storage layout).
- One logical change per PR; keep history reviewable. Prefer per-file commits.
- Code, comments, and commit messages in English.

## Commit / PR format

- Conventional-commit style subjects (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- PRs that close an issue must say `Closes #<issue>`.

## Security

Do not open public issues for vulnerabilities — see [SECURITY.md](./SECURITY.md).
