#!/bin/sh
set -eu
exec dotnet run --project ./tools/DeploymentPreflight --configuration Release --no-launch-profile -- --interactive
