# Admurin Pixel Character V1.4 (WandGlad Costumes) — index

Source: `~/Downloads/PixelCharacter_V1.4 (Costumes)`
Creator: [Admurin](https://admurin.itch.io/pixel-character)
License: commercial use OK inside a game; do not redistribute as standalone assets; no NFTs / AI training. Credit optional.

## Geometry
- Cell: **64×48** (death: 64×64)
- Full wanderer atlas: **576×1152** (9×24)
- Author directions: 2 (most strips face **right**; we mirror for left)
- Timing: **10 FPS** (0.1s/frame)

## Full atlas rows used
| Row | Frames | Use |
|-----|--------|-----|
| 0 | 3 | Idle → `heroes/*/idle.png` |
| 4 | 8 | Run → `heroes/*/run.png` |
| 5 | 8 | Walk → `heroes/*/walk.png` |

## Party mapping (Wanderer composed sets)
| Role | Set |
|------|-----|
| paladin | Set_Steel |
| ranger | Set_Copper |
| wizard | Set_Cobalt |
| bard | Set_Gold |
| cleric | Set_Angelic |

Extracted sheets are single-row strips, with archival copies under `party/*/`. `HeroParty` selects idle, walk, or run from movement input; facing left uses texture mirroring in `spriteSheet`.
