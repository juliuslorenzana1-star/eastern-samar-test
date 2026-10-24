# Geographic sources

Province outline: geoBoundaries gbOpen PHL ADM2, Eastern Samar.
Municipality/city polygons: geoBoundaries gbOpen PHL ADM3, boundary ID `PHL-ADM3-30758251`, representing 2020 boundaries, published 12 December 2023.

Source agencies: National Mapping and Resource Information Authority (NAMRIA), Philippines Statistics Authority (PSA), OCHA Philippines. License: Creative Commons Attribution 3.0 Intergovernmental Organisations (CC BY 3.0 IGO).

Metadata: https://www.geoboundaries.org/api/current/gbOpen/PHL/ADM3/

Upstream dataset: https://data.humdata.org/dataset/philippines-administrative-levels-0-to-3

Pinned input: https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/PHL/ADM3/geoBoundaries-PHL-ADM3_simplified.geojson

Reproduce: download that input outside the repository, then `node scripts/prepare-geography.mjs <downloaded-file>`. The script selects known municipality names within the province extent and requires exactly 23 unique matches. Coordinates are preserved from the source, without invented centroids. Map fit uses polygon bounds. These are reference boundaries, not a legal survey or a claim of current cadastral accuracy.

Barangay polygons are not included: no verified barangay boundary source has been acquired. Search supports barangay names supplied in published reports; it does not claim polygon coverage.
