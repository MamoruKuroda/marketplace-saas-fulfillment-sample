#!/usr/bin/env pwsh
$ErrorActionPreference = 'Stop'
dotnet run --project ./tools/DeploymentPreflight --configuration Release --no-launch-profile
exit $LASTEXITCODE
