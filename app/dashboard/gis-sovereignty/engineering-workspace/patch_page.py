import re

with open('page.tsx', 'r') as f:
    content = f.read()

if 'useProjectStore' not in content:
    content = content.replace(
        "import React from 'react';",
        "import React, { useEffect } from 'react';\nimport { useProjectStore } from '../../../../../store/projectStore';\nimport { useLayerStore } from '../../../../../store/layerStore';\nimport { useWorkspaceStore } from '../../../../../store/workspaceStore';"
    )
    content = content.replace(
        "export default function EngineeringWorkspace() {",
        "export default function EngineeringWorkspace() {\n  const loadProjects = useProjectStore(s => s.loadProjects);\n  const activeProjectId = useProjectStore(s => s.activeProjectId);\n  const loadLayers = useLayerStore(s => s.loadLayers);\n  const loadAssets = useWorkspaceStore(s => s.loadAssets);\n\n  useEffect(() => {\n    loadProjects();\n  }, [loadProjects]);\n\n  useEffect(() => {\n    if (activeProjectId) {\n      loadLayers(activeProjectId);\n      loadAssets(activeProjectId);\n    }\n  }, [activeProjectId, loadLayers, loadAssets]);\n"
    )
    with open('page.tsx', 'w') as f:
        f.write(content)
        print("Patched page.tsx")
