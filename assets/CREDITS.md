Tileset: [RPG Urban Pack](https://kenney.nl/assets/rpg-urban-pack) by Kenney (kenney.nl), CC0 1.0 — placeholder art, swapped for custom Higgsfield sprites later.

## Custom sprites (Higgsfield)

Character (`assets/sprites/player.png`) and all 7 building sprites
(`assets/sprites/buildings/*.png`) generated with
[Higgsfield](https://higgsfield.ai) using the **Nano Banana Pro**
(`nano_banana_2`) image model, via the `higgsfield` CLI, per the prompts and
style spec in `assets/higgsfield-spec.md`.

Generation workflow: each asset generated on a solid chroma-key magenta
(#ff00ff) backdrop (Nano Banana Pro doesn't support native alpha output),
then background-keyed to transparency, edge-cleaned, and downscaled with
nearest-neighbor to the exact target pixel size via a local script (not
Higgsfield's built-in background remover, which was tried but its API
requires an undocumented media-object schema not worth reverse-engineering
further). The 20 character frames were generated individually from one
locked reference pose using Higgsfield's `input_images` character-consistency
input, then bbox-normalized (consistent height + ground-aligned) before
packing into the sheet — the reference model didn't reliably distinguish
left- vs. right-facing prompts, so the right-facing row is a horizontal
mirror of the left-facing row rather than an independent generation.

## Audio

- Footsteps (`assets/audio/footstep-1.ogg`, `footstep-2.ogg`): stone-surface
  steps from [Fantozzi's Footsteps (Grass/Sand & Stone)](https://opengameart.org/content/fantozzis-footsteps-grasssand-stone)
  by Fantozzi, OpenGameArt.org, CC0.
- Ambient town loop (`assets/audio/ambient-town.mp3`): trimmed/faded excerpt
  of "Forest Ambience" from [CC0 Background Ambience](https://opengameart.org/content/cc0-background-ambience)
  by FGResources, OpenGameArt.org, CC0.
