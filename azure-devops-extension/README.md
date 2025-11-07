# Agile Board Azure DevOps Extension

## Purpose
Adds a custom hub under Azure Boards for multi-team iteration planning, sticky notes, and dependency visualization.

## Structure
- `vss-extension.json` Manifest describing hub contribution.
- `my-board.html` Hub page bootstrapping the existing board app via iframe.
- `sdk/azure-devops-extension-sdk.js` Azure DevOps Extension SDK (add via npm or copy during build).

## Getting Started
1. Install dependencies:
   ```bash
   npm install azure-devops-extension-sdk tfx-cli --save-dev
   ```
2. Add the SDK script to `sdk/` (copy from `node_modules/azure-devops-extension-sdk/dist/`).
3. Package extension:
   ```bash
   npx tfx extension create --manifest-globs vss-extension.json --rev-version
   ```
4. Publish (private during development):
   ```bash
   npx tfx extension publish --manifest-globs vss-extension.json --publisher your-publisher-id --auth-type pat --token YOUR_PAT
   ```
5. Install into your Azure DevOps organization.

## Mapping Existing App
Your current board UI (index.html + board.js) should be hosted (Azure App Service or Static Web Apps). The extension iframe loads it and passes `project` and `team` query params you can use to scope data.

## Next Steps
- Replace access code sessions with Azure DevOps project/team scoping.
- Secure backend with Azure AD / PAT validation.
- Add additional contributions (actions, context menus) if needed.

## Security Notes
Do not store PAT or secrets in client code. Use backend service for privileged calls.
