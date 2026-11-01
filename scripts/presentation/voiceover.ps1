param([string]$OutputDirectory = 'presentation-output.local')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$resolvedOutput = [IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputDirectory))
New-Item -ItemType Directory -Path $resolvedOutput -Force | Out-Null
$scenes = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'storyboard.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $speaker.SelectVoice('Microsoft David Desktop')
  $speaker.Rate = 0
  foreach ($scene in $scenes) {
    if ($scene.id -eq '07-vision') { $speaker.Rate = 1 } else { $speaker.Rate = 0 }
    $speaker.SetOutputToWaveFile((Join-Path $resolvedOutput ($scene.id + '.wav')))
    $speaker.Speak($scene.voice)
    $speaker.SetOutputToNull()
    Write-Output ('Rendered offline narration: ' + $scene.id)
  }
} finally { $speaker.Dispose() }
