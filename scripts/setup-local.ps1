# Installation locale de Vigie en une commande (Windows / PowerShell).
# Usage, depuis la racine du depot :
#   powershell -ExecutionPolicy Bypass -File scripts\setup-local.ps1
#
# Ce que fait le script :
#   1. cree le fichier .env avec des secrets aleatoires (s'il n'existe pas deja)
#   2. demarre PostgreSQL avec Docker et attend qu'il soit pret
#   3. cree les tables (migrations)
#   4. cree le premier compte administrateur
# Le mot de passe admin est demande au clavier et n'est jamais ecrit dans un fichier.

# Les commandes externes (docker, npm) sont verifiees via leur code de sortie.
$ErrorActionPreference = "Continue"
Set-Location (Split-Path -Parent $PSScriptRoot)

function Step($message) { Write-Host "`n==> $message" -ForegroundColor Cyan }
function Fail($message) { Write-Host "ERREUR : $message" -ForegroundColor Red; exit 1 }

# Vrai si le port est utilisable sur 127.0.0.1 (Windows reserve parfois des plages entieres).
function Test-PortFree([int]$port) {
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
    $listener.Start(); $listener.Stop(); return $true
  } catch { return $false }
}

function New-RandomHex([int]$bytes) {
  $buffer = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer)
  return ($buffer | ForEach-Object { $_.ToString("x2") }) -join ""
}

# --- Verifications ---------------------------------------------------------
Step "Verification de Docker et Node"
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker ne repond pas. Lance Docker Desktop, attends qu'il ait demarre, puis relance ce script." }
node --version *> $null
if ($LASTEXITCODE -ne 0) { Fail "Node.js est introuvable." }
if (-not (Test-Path "node_modules")) {
  Step "Installation des dependances (npm install)"
  npm install
  if ($LASTEXITCODE -ne 0) { Fail "npm install a echoue." }
}

# --- 1. Fichier .env -------------------------------------------------------
if (Test-Path ".env") {
  Step ".env existe deja : je le garde tel quel"
} else {
  Step "Creation du fichier .env avec des secrets aleatoires"
  $dbPort = @(5432, 5433, 15432, 25432, 35432, 45432) | Where-Object { Test-PortFree $_ } | Select-Object -First 1
  if (-not $dbPort) { Fail "Aucun port libre trouve pour PostgreSQL." }
  if ($dbPort -ne 5432) { Write-Host "    Le port 5432 est indisponible sur ce PC : PostgreSQL utilisera le port $dbPort." }
  $dbPassword = New-RandomHex 16
  $jwtSecret = New-RandomHex 32
  $content = Get-Content ".env.example" -Encoding UTF8 | ForEach-Object {
    $_ -replace '^POSTGRES_PASSWORD=.*', "POSTGRES_PASSWORD=$dbPassword" `
       -replace '^POSTGRES_PORT=.*', "POSTGRES_PORT=$dbPort" `
       -replace '^DATABASE_URL=.*', "DATABASE_URL=postgresql://vigie:$dbPassword@localhost:$dbPort/vigie" `
       -replace '^JWT_ACCESS_SECRET=.*', "JWT_ACCESS_SECRET=$jwtSecret" `
       -replace '^SEED_ADMIN_PASSWORD=.*', "# SEED_ADMIN_PASSWORD : demande au clavier par scripts/setup-local.ps1"
  }
  # UTF-8 sans BOM (lisible par Node, quelle que soit la version de PowerShell)
  [System.IO.File]::WriteAllLines((Join-Path (Get-Location) ".env"), [string[]]$content, (New-Object System.Text.UTF8Encoding $false))
  Write-Host "    .env cree (il est ignore par Git, ne le partage pas)."
}

# --- 2. PostgreSQL ---------------------------------------------------------
Step "Demarrage de PostgreSQL (docker compose up -d)"
docker compose up -d
if ($LASTEXITCODE -ne 0) { Fail "docker compose a echoue." }

Write-Host "    Attente que la base soit prete..." -NoNewline
$containerId = (docker compose ps -q db).Trim()
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  $status = (docker inspect --format "{{.State.Health.Status}}" $containerId).Trim()
  if ($status -eq "healthy") { $ready = $true; break }
  Write-Host "." -NoNewline
  Start-Sleep -Seconds 2
}
Write-Host ""
if (-not $ready) { Fail "PostgreSQL n'est pas pret apres 2 minutes. Regarde les logs avec : docker compose logs db" }

# --- 3. Migrations ---------------------------------------------------------
Step "Creation des tables (migrations)"
npm run db:migrate -w @vigie/api
if ($LASTEXITCODE -ne 0) { Fail "Les migrations ont echoue." }

# --- 4. Compte administrateur ----------------------------------------------
Step "Creation du compte administrateur"
$policy = '^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{12,128}$'
# VIGIE_ADMIN_PASSWORD permet un lancement non interactif (tests automatises).
$plain1 = $env:VIGIE_ADMIN_PASSWORD
if ($plain1 -and $plain1 -cnotmatch $policy) { Fail "VIGIE_ADMIN_PASSWORD est trop faible." }
while (-not $plain1) {
  Write-Host "    Mot de passe admin : 12 caracteres minimum, avec une majuscule, une minuscule et un chiffre."
  $secure1 = Read-Host "    Mot de passe" -AsSecureString
  $secure2 = Read-Host "    Confirme le mot de passe" -AsSecureString
  $plain1 = [System.Net.NetworkCredential]::new("", $secure1).Password
  $plain2 = [System.Net.NetworkCredential]::new("", $secure2).Password
  if ($plain1 -cne $plain2) { Write-Host "    Les deux mots de passe sont differents, recommence." -ForegroundColor Yellow; $plain1 = $null; continue }
  if ($plain1 -cnotmatch $policy) { Write-Host "    Mot de passe trop faible, recommence." -ForegroundColor Yellow; $plain1 = $null; continue }
}

# Le mot de passe passe uniquement par une variable d'environnement de ce processus.
$env:SEED_ADMIN_PASSWORD = $plain1
try {
  npm run db:seed -w @vigie/api
  $seedExit = $LASTEXITCODE
} finally {
  Remove-Item Env:SEED_ADMIN_PASSWORD -ErrorAction SilentlyContinue
  $plain1 = $null; $plain2 = $null
}
if ($seedExit -ne 0) { Fail "La creation de l'administrateur a echoue." }

# --- Fin -------------------------------------------------------------------
$adminEmail = ((Get-Content ".env" | Where-Object { $_ -match '^SEED_ADMIN_EMAIL=' }) -replace '^SEED_ADMIN_EMAIL=', '')
Write-Host "`nTout est pret !" -ForegroundColor Green
Write-Host "  Compte admin : $adminEmail"
Write-Host "  Pour lancer l'API :  npm run dev -w @vigie/api"
Write-Host "  Puis ouvre :         http://localhost:3000/api/health"
