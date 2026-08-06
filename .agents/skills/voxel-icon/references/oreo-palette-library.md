# Oreo avatar complete palette library

This file is the skill's authoritative, self-contained 40-preset light palette registry. It is an immutable local snapshot originally captured from `BIAsia/oreo-design-avatar` at commit `44b061bf20e894af96ef8afa31b82e94192d3b50`; do not fetch that repository or depend on it at runtime.

Use this as the color search space. Do not reduce production selection to a short curated subset.

Each preset has nine semantic tokens:

- `base`, `lobe`: large-mass and layer colors;
- `accent`: high-salience focal color;
- `pale`, `light`: quiet carriers and bright separators;
- `warm`, `cool`: companion colors;
- `dark`: structural anchor and recess;
- `beam`: optional bright illuminated component, never a lighting gradient.

| ID | Name | Base | Lobe | Accent | Pale | Light | Warm | Cool | Dark | Beam |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `rose-milk` | Rose Milk | `#FFDEDF` | `#FFAAAA` | `#FB4FBC` | `#FEE9F5` | `#FFFFFF` | `#FFD9B8` | `#7CB2FF` | `#031A05` | `#57B565` |
| `peach-cream` | Peach Cream | `#FFE1BD` | `#FF9A44` | `#FF6044` | `#FFF2CE` | `#FFFCE2` | `#FFC744` | `#AEC6CF` | `#CC4E00` | `#FFBE74` |
| `mint-milk` | Mint Milk | `#D7F5E9` | `#8BE8CB` | `#49CDA9` | `#F5FFE9` | `#FFFFFF` | `#FFE1BD` | `#42CBA9` | `#063A3B` | `#93FFD2` |
| `aurora-pink` | Aurora Pink | `#BDD5FF` | `#FF7AC1` | `#FF0084` | `#75ECFF` | `#FFF8FF` | `#FFD6F1` | `#7FB1FF` | `#16052F` | `#71ABFF` |
| `lilac-silk` | Lilac Silk | `#D8C8FF` | `#B7CFFF` | `#7258FF` | `#FFFCE2` | `#FFF8FF` | `#FFD6F1` | `#8B72FF` | `#6C55B8` | `#B077FF` |
| `blue-cream` | Blue Cream | `#C5D9FF` | `#7FCFFF` | `#3158B8` | `#F7FFE4` | `#FFF1C8` | `#FFF1C8` | `#7FB1FF` | `#17356F` | `#72DFF8` |
| `jade-cream` | Jade Cream | `#C8EADC` | `#8BE8CB` | `#39D2A8` | `#EFFFD8` | `#FFFFDF` | `#FFE1BD` | `#3C8F7F` | `#03534F` | `#B4F1A9` |
| `coral-mist` | Coral Mist | `#FFD7CB` | `#FF79A6` | `#FF2F91` | `#FFE7D0` | `#FFF5EA` | `#FF8FBA` | `#B7CFFF` | `#9D0051` | `#FFB0D0` |
| `lemon-mint` | Lemon Mint | `#FFF9B8` | `#B4F1A9` | `#39D2A8` | `#EFFFD8` | `#FFFFDF` | `#FFD95A` | `#8BE8CB` | `#31886D` | `#9CFFD4` |
| `violet-peach` | Violet Peach | `#FFE0C8` | `#FF9A72` | `#8B72FF` | `#FFF2DE` | `#FFF8FF` | `#FF7B68` | `#B7A8FF` | `#5C3AA5` | `#D7B1FF` |
| `magenta-void` | Magenta Void | `#5531D8` | `#FF43B8` | `#FF43B8` | `#F3D7FF` | `#FFF8FF` | `#FF8AD6` | `#5531D8` | `#16052F` | `#B077FF` |
| `teal-void` | Teal Void | `#118F84` | `#5ED9C3` | `#93FFD2` | `#D8FFF1` | `#F8FFFB` | `#FFD29D` | `#118F84` | `#063A3B` | `#93FFD2` |
| `amber-dusk` | Amber Dusk | `#FFD29D` | `#FFB75D` | `#FFCF87` | `#FFF2C8` | `#FFF8E8` | `#FF8F47` | `#70478F` | `#70478F` | `#FFD071` |
| `sky-melon` | Sky Melon | `#C6E7FF` | `#9CE7AD` | `#FF7A72` | `#F5FFE9` | `#FFFFFF` | `#FFD5A6` | `#65B7FF` | `#234C7A` | `#93FFD2` |
| `grapefruit` | Grapefruit | `#FFD1C7` | `#FF8971` | `#FF3C75` | `#FFF0D9` | `#FFFAF4` | `#FFBB61` | `#9FD9FF` | `#8C2450` | `#FFB4C8` |
| `lavender-lime` | Lavender Lime | `#E3D3FF` | `#C8F67C` | `#9B72FF` | `#F6FFD1` | `#FFFFFF` | `#FFF191` | `#9ED6FF` | `#50408F` | `#C8FF90` |
| `aqua-orchid` | Aqua Orchid | `#C7F8FF` | `#9C8CFF` | `#FF64C8` | `#EAFFFF` | `#FFFFFF` | `#FFCFE8` | `#57D5FF` | `#26327A` | `#9CF5FF` |
| `honeydew` | Honeydew | `#F7FFD8` | `#A5E6A3` | `#58C983` | `#FFFFDF` | `#FFFFFF` | `#FFE7A6` | `#B7D9FF` | `#3B7A55` | `#C7FF9D` |
| `plum-gold` | Plum Gold | `#D7B7E8` | `#FFC86B` | `#8E54FF` | `#FFF0C8` | `#FFF8EF` | `#FFC65A` | `#9B72FF` | `#47245F` | `#FFDF88` |
| `ice-berry` | Ice Berry | `#D5F0FF` | `#FF8AB8` | `#DD4BFF` | `#F2F9FF` | `#FFFFFF` | `#FFD7E7` | `#7FD7FF` | `#2A376E` | `#BCEcff` |
| `apricot-mint` | Apricot Mint | `#FFE0BD` | `#8FE5C0` | `#FF8A3D` | `#F6FFE4` | `#FFFFFF` | `#FFC26E` | `#6FD8BF` | `#4D715C` | `#BFFFE2` |
| `candy-blue` | Candy Blue | `#D8E0FF` | `#FF97D7` | `#4879FF` | `#FFF1FB` | `#FFFFFF` | `#FFD7EE` | `#71ABFF` | `#223584` | `#85E6FF` |
| `raspberry-cream` | Raspberry Cream | `#FFD9E8` | `#FF5EA8` | `#E90075` | `#FFF4D8` | `#FFFDF0` | `#FFB877` | `#D9C8FF` | `#7D1349` | `#FFAAD0` |
| `spring-glow` | Spring Glow | `#DDFFD8` | `#7EE7A5` | `#FFCF4D` | `#FFFFD7` | `#FFFFFF` | `#FFD76A` | `#86D7FF` | `#23734D` | `#C8FF72` |
| `sunset-punch` | Sunset Punch | `#FFD2A6` | `#FF6D5C` | `#FF2F91` | `#FFEEC9` | `#FFF8E8` | `#FFB13D` | `#8D98FF` | `#813047` | `#FFC469` |
| `moon-pearl` | Moon Pearl | `#EDF0FF` | `#D8C8FF` | `#93B4FF` | `#FFFBE7` | `#FFFFFF` | `#FFE7C6` | `#B6CFFF` | `#4D5A7F` | `#D4E8FF` |
| `seafoam-rose` | Seafoam Rose | `#D7FFF0` | `#FF99BA` | `#40C7A5` | `#F7FFE8` | `#FFFFFF` | `#FFD7D0` | `#79E1D2` | `#1F6F67` | `#A4FFE8` |
| `blueberry-milk` | Blueberry Milk | `#D4D9FF` | `#927BFF` | `#4D2DCE` | `#EDF5FF` | `#FFFFFF` | `#FFD6F1` | `#74B8FF` | `#231857` | `#95D7FF` |
| `mango-iris` | Mango Iris | `#FFE4A8` | `#FF9D4D` | `#855FFF` | `#FFF4D0` | `#FFF8EF` | `#FFBD56` | `#AD9CFF` | `#5F3F87` | `#FFD87D` |
| `forest-neon` | Forest Neon | `#9EDFC9` | `#54C7A8` | `#83FFB5` | `#E6FFF1` | `#FFFFFF` | `#FFD08A` | `#2FAE98` | `#073830` | `#83FFB5` |
| `cotton-candy` | Cotton Candy | `#FFD5F0` | `#A7D8FF` | `#FF5FC7` | `#F8EDFF` | `#FFFFFF` | `#FFD4E7` | `#8CC8FF` | `#763069` | `#BDEFFF` |
| `lime-sorbet` | Lime Sorbet | `#ECFFD0` | `#A7EF63` | `#36CDB2` | `#FFFFD9` | `#FFFFFF` | `#FFE889` | `#80DDFF` | `#3E7C3A` | `#C6FF7E` |
| `cherry-cola` | Cherry Cola | `#FFCAD6` | `#B54475` | `#FF3F7F` | `#FFE5C8` | `#FFF2E7` | `#FFAE5E` | `#7B62D9` | `#2A0714` | `#FF86AA` |
| `opal-mint` | Opal Mint | `#E6FFF8` | `#B8F4DF` | `#82D8FF` | `#FFFCE7` | `#FFFFFF` | `#FFE8C2` | `#97E2FF` | `#4B7C78` | `#D0FFF0` |
| `peach-lilac` | Peach Lilac | `#FFE0D6` | `#D7B5FF` | `#FF7F95` | `#FFF1E5` | `#FFFFFF` | `#FFBF8C` | `#BCA8FF` | `#74568F` | `#FFC6DD` |
| `cyan-flame` | Cyan Flame | `#CCF4FF` | `#62D9FF` | `#FF7A32` | `#FFF0D8` | `#FFFFFF` | `#FFAD58` | `#3CCFFF` | `#135078` | `#9FF7FF` |
| `orchid-night` | Orchid Night | `#8B72FF` | `#FF6FCB` | `#FF3FB4` | `#EAD7FF` | `#FFF8FF` | `#FF9CCF` | `#6E55D9` | `#12072C` | `#C38BFF` |
| `pistachio-blush` | Pistachio Blush | `#E7FFD7` | `#A4E7A0` | `#FF8EB0` | `#FFF7D6` | `#FFFFFF` | `#FFD0B1` | `#98D9C2` | `#4A7A51` | `#CCFFA2` |
| `lagoon-gold` | Lagoon Gold | `#BFF2E8` | `#45C1B2` | `#FFC14D` | `#FFF4C8` | `#FFFFFF` | `#FFD66B` | `#3AB7E4` | `#07545A` | `#93FFD2` |
| `vanilla-sky` | Vanilla Sky | `#FFF2C8` | `#B9D9FF` | `#FF9D5C` | `#FFFFE8` | `#FFFFFF` | `#FFD68F` | `#8FC8FF` | `#4B638C` | `#D4EBFF` |

## Tone transform

After selecting a preset, adjust the whole palette with the source model:

- `hue`: one global OKLCH rotation;
- `chroma`: one relative-sRGB-gamut chroma multiplier;
- `lightness`: one shared OKLCH lightness delta.

If the voxel body maps to a token other than `accent`, compute the global hue shift from that mapped body token:

```text
delta_h = native_body_hue - preset_body_token_hue
tone.hue = preset_accent_hue + delta_h
```

Apply the same `delta_h` to every chromatic token. Keep neutral `light` and functional black/white neutral. Never tune tokens independently.
