.PHONY: setup dev test quality build workflow live prototype

# Use PowerShell 7 by default; override with make POWERSHELL=powershell test.
POWERSHELL ?= pwsh

setup dev test quality build workflow live prototype:
	$(POWERSHELL) -NoProfile -File ./defense.ps1 -Action $@
