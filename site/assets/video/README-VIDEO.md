# Hero-Video einsetzen

1. Im Vimeo-Konto das Video https://vimeo.com/1041782753 herunterladen
   (als Inhaber: Video öffnen → ⋯ / Download → höchste Qualität).
2. Optimieren (falls ffmpeg vorhanden – sonst Datei einfach im Claude-Chat
   hochladen, dann übernehme ich das):

   ffmpeg -i original.mp4 -an -vf "scale=1600:-2" -c:v libx264 -crf 26 \
     -preset slow -movflags +faststart -t 25 assets/video/hero.mp4

   Ziel: stumm (-an), max. ~20–25 s Loop, 1600px breit, Datei < 4–6 MB.
3. Poster-Standbild erzeugen:

   ffmpeg -i assets/video/hero.mp4 -ss 2 -frames:v 1 -q:v 3 assets/img/hero-poster.jpg

4. Beide Dateien liegen dann an den Pfaden, die index.html bereits erwartet:
   - assets/video/hero.mp4
   - assets/img/hero-poster.jpg

Solange die Dateien fehlen, zeigt die Seite automatisch den Gradient-Hero –
nichts ist kaputt.
