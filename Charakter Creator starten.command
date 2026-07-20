#!/bin/bash
# Doppelklick im Finder startet die App und öffnet sie im Browser.
# Fenster offen lassen – der Server läuft, solange dieses Fenster offen ist.
# Beenden mit Strg+C oder Schließen des Fensters.

cd "$(dirname "$0")" || exit 1

# Der Finder startet Skripte mit einer minimalen PATH-Umgebung: die üblichen
# Node-Installationsorte fehlen dort, deshalb hier ergänzt.
export PATH="$HOME/.local/node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm wurde nicht gefunden."
  echo "Bitte Node.js installieren (https://nodejs.org) und erneut versuchen."
  echo
  read -r -p "Enter zum Schließen …"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Abhängigkeiten fehlen – installiere sie einmalig (das dauert etwas) …"
  npm install || { echo; read -r -p "Fehlgeschlagen. Enter zum Schließen …"; exit 1; }
fi

PORT=3000
# Nächsten freien Port suchen – Next.js weicht sonst selbst aus, und dann
# zeigte der Browser auf die falsche Adresse.
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://localhost:$PORT"
echo "Starte Charakter Creator auf $URL …"

# Browser erst öffnen, wenn der Server antwortet.
(
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "$URL"; then
      open "$URL"
      exit 0
    fi
    sleep 1
  done
) &

exec npm run dev -- --port "$PORT"
