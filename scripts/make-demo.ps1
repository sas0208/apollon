# Alternativa Windows quando una sandbox impedisce a Node di creare processi figli.
# Eseguire soltanto dopo il preflight della macchina. Solo disegni generati dal codice, audio muto e toni sintetici.
# Giro F: Node prepara disegni e comandi (nessun processo figlio), PowerShell lancia ffmpeg uno alla volta,
# poi Node scrive date e indice della demo (durate, lingue, immagini gia pronte).
$ErrorActionPreference = 'Stop'
$appRoot = Split-Path $PSScriptRoot -Parent
$demoBase = Join-Path $appRoot 'demo-data'
Push-Location $appRoot
try {
    & node scripts/make-demo.js --piano
    if ($LASTEXITCODE -ne 0) { throw 'Piano della demo non riuscito.' }
    $plan = Get-Content -LiteralPath (Join-Path $demoBase '.arte\piano.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $done = 0
    foreach ($job in @($plan.jobs)) {
        $ffmpegArgs = @($job.args)
        & ffmpeg @ffmpegArgs
        if ($LASTEXITCODE -ne 0) { throw "Generazione non riuscita: $($job.rel)" }
        $done++
        if ($done % 15 -eq 0) { Write-Output "  $done/$(@($plan.jobs).Count) comandi ffmpeg" }
    }
    & node scripts/make-demo.js --indice
    if ($LASTEXITCODE -ne 0) { throw 'Indice della demo non scritto.' }
    $sourceSong = Join-Path $demoBase 'Musica\Luce di casa.wav'
    if (-not (Test-Path -LiteralPath $sourceSong)) {
        & ffmpeg -nostdin -hide_banner -loglevel error -threads 1 -f lavfi -i 'sine=frequency=330:sample_rate=44100' -t 12 -c:a pcm_s16le $sourceSong
        if ($LASTEXITCODE -ne 0) { throw 'Generazione del tono finto non riuscita.' }
    }
    Write-Output 'Demo pronta: disegni generati, audio muto e toni, nessun file personale.'
} finally {
    Pop-Location
}
