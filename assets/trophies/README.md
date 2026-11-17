# Pass the Code — Trophy studies

Five independent cone trophy models, plus a collection containing all five.

- Colors: Lemon #efff35, Lime #8dff00, Cyan #00e2fa, Blue #1299ff, Magenta #ff00c8.
- Format: binary glTF 2.0 (.glb), geometry and materials embedded.
- Rounded point, lightly rounded base edge, closed solid-of-revolution geometry.
- Exported height: 336 mm (glTF meters). The scene node applies a uniform 0.06 scale to the modeling geometry.
- Awards: Lemon — Audience Choice; Lime — Innovation Award; Cyan — Best Visuals; Blue — Best Collaboration; Magenta — Best Transformation.
- Each trophy also includes the exact supplied Frame 9.svg “pass the code 2027” vector lockup.
- The shallow engraving is represented by a normal-map relief, not a geometry boolean cut.
- Each trophy has one solid palette color with black vertical award lettering embedded in its base-color texture; surface light and shade come from the studio lighting.
- Satin resin materials are opaque and nonmetallic, with roughness 0.43 and a soft clearcoat layer (KHR_materials_clearcoat).

Open ../../trophies.html using the local server to orbit, zoom, inspect one color, or download the models.
These are visualization assets; fabrication preparation has not been performed.

The fine resin grain and incised text bevel are baked together in an embedded tangent-space normal map. Base-color and normal PNGs are self-contained in each GLB.

Viewer lighting and the reflection studio follow the camera, preserving the right-side highlight and left-side shading while orbiting. The engraving normal map uses normal scale 1.1.

To rebuild lettering, run `swift -module-cache-path /private/tmp/trophy-swift-module-cache scripts/engrave-trophies.swift` from the repository root, then `node scripts/export-trophies.mjs`.

The logo is rasterized directly from the supplied SVG paths, preserving its original proportions and raised year. Award names use Inter ExtraLight (weight 200), at 82% of the main logo ascender height. The logo SVG is unchanged. Normal-map bevels and narrow shaded lips give all lettering a recessed appearance.
