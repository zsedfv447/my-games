/** Base-character meshes use exporter-generated object names. Classify the skin material,
 * not the object name: the male body is named Sphere.005_Retopology.004 in the shipped asset.
 * Outfit fabrics, eyes and eyebrows must remain complete and must never enter head cropping. */
export function isBaseBodyMaterial(materialNames:readonly string[]):boolean {
  return materialNames.some(name=>/^MI_Superhero_(Male|Female)$/.test(name));
}
