import os
import uuid
from flask import Flask, request, jsonify, send_from_directory, render_template
from database import db, Song, Playlist, PlaylistSong
from mutagen import File as MutagenFile

# ── CONFIG ────────────────────────────────────────────────────
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "mango-secret-dev-key")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(BASE_DIR, 'mango.db')}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["UPLOAD_FOLDER"] = os.path.join(BASE_DIR, "static", "uploads")
app.config["MAX_CONTENT_LENGTH"] = 100 * 1024 * 1024  # 100 MB

ALLOWED_EXTENSIONS = {"mp3", "wav", "ogg", "flac", "m4a"}

db.init_app(app)

# ── HELPERS ───────────────────────────────────────────────────
def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def read_id3_tags(filepath: str) -> dict:
    info = {"title": None, "artist": None, "album": None, "duration": 0}
    try:
        audio = MutagenFile(filepath, easy=True)
        if audio is None: return info
        info["title"] = (audio.get("title") or [None])[0]
        info["artist"] = (audio.get("artist") or [None])[0]
        info["album"] = (audio.get("album") or [None])[0]
        if hasattr(audio, "info") and hasattr(audio.info, "length"):
            info["duration"] = round(audio.info.length, 2)
    except Exception:
        pass
    return info

def song_to_dict(song: Song) -> dict:
    return {
        "id": song.id,
        "title": song.title,
        "artist": song.artist,
        "album": song.album,
        "duration": song.duration,
        "liked": song.liked,
        "lyrics": song.lyrics or "",
        "filename": song.filename,
        "url": f"/stream/{song.id}",
        "added_at": song.added_at.isoformat() if song.added_at else None,
    }

def pl_to_dict(pl: Playlist) -> dict:
    song_ids = [ps.song_id for ps in PlaylistSong.query.filter_by(playlist_id=pl.id).order_by(PlaylistSong.id).all()]
    return {
        "id": pl.id,
        "name": pl.name,
        "song_ids": song_ids,
        "created_at": pl.created_at.isoformat() if pl.created_at else None,
    }

# ── AUTO-SCAN LOGIC ───────────────────────────────────────────
def auto_scan_on_startup():
    """Escanea la carpeta uploads y registra archivos nuevos en la DB."""
    if not os.path.exists(app.config["UPLOAD_FOLDER"]):
        os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)
        return

    files = [f for f in os.listdir(app.config["UPLOAD_FOLDER"]) if allowed_file(f)]
    new_count = 0

    for file in files:
        exists = Song.query.filter_by(filename=file).first()
        if not exists:
            path = os.path.join(app.config["UPLOAD_FOLDER"], file)
            tags = read_id3_tags(path)
            raw_name = os.path.splitext(file)[0].replace("-", " ").replace("_", " ").strip()
            
            new_song = Song(
                title=tags["title"] or raw_name,
                artist=tags["artist"] or "Artista desconocido",
                album=tags["album"] or "—",
                duration=tags["duration"],
                filename=file
            )
            db.session.add(new_song)
            new_count += 1
    
    if new_count > 0:
        db.session.commit()
        print(f"✅ Escaneo completado: {new_count} canciones nuevas añadidas.")

# ── ROUTES ────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/stream/<int:song_id>")
def stream_song(song_id):
    song = Song.query.get_or_404(song_id)
    return send_from_directory(app.config["UPLOAD_FOLDER"], song.filename)

# ── SONGS API ─────────────────────────────────────────────────
@app.route("/api/songs", methods=["GET"])
def get_songs():
    songs = Song.query.order_by(Song.added_at.desc()).all()
    return jsonify([song_to_dict(s) for s in songs])

@app.route("/api/songs/upload", methods=["POST"])
def upload_songs():
    if "files" not in request.files:
        return jsonify({"error": "No se enviaron archivos"}), 400

    files = request.files.getlist("files")
    uploaded = []
    
    for file in files:
        if file.filename == "" or not allowed_file(file.filename): continue

        ext = file.filename.rsplit(".", 1)[1].lower()
        unique_name = f"{uuid.uuid4().hex}.{ext}"
        save_path = os.path.join(app.config["UPLOAD_FOLDER"], unique_name)
        file.save(save_path)

        tags = read_id3_tags(save_path)
        raw_name = os.path.splitext(file.filename)[0].replace("-", " ").replace("_", " ").strip()

        song = Song(
            title=tags["title"] or raw_name,
            artist=tags["artist"] or "Artista desconocido",
            album=tags["album"] or "—",
            duration=tags["duration"],
            filename=unique_name,
        )
        db.session.add(song)
        db.session.flush()
        uploaded.append(song_to_dict(song))

    db.session.commit()
    return jsonify({"uploaded": uploaded}), 201

@app.route("/api/songs/<int:song_id>", methods=["PATCH"])
def update_song(song_id):
    song = Song.query.get_or_404(song_id)
    data = request.get_json(silent=True) or {}
    for field in ["liked", "lyrics", "title", "artist", "album"]:
        if field in data:
            setattr(song, field, data[field])
    db.session.commit()
    return jsonify(song_to_dict(song))

@app.route("/api/songs/<int:song_id>", methods=["DELETE"])
def delete_song(song_id):
    song = Song.query.get_or_404(song_id)
    try:
        os.remove(os.path.join(app.config["UPLOAD_FOLDER"], song.filename))
    except FileNotFoundError: pass
    db.session.delete(song)
    db.session.commit()
    return jsonify({"deleted": song_id})

# ── PLAYLISTS API ─────────────────────────────────────────────
@app.route("/api/playlists", methods=["GET"])
def get_playlists():
    pls = Playlist.query.order_by(Playlist.created_at).all()
    return jsonify([pl_to_dict(p) for p in pls])

@app.route("/api/playlists", methods=["POST"])
def create_playlist():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name: return jsonify({"error": "Nombre requerido"}), 400
    pl = Playlist(name=name)
    db.session.add(pl)
    db.session.commit()
    return jsonify(pl_to_dict(pl)), 201

@app.route("/api/playlists/<int:pl_id>/songs", methods=["POST"])
def add_to_pl(pl_id):
    data = request.get_json(silent=True) or {}
    song_id = data.get("song_id")
    if not PlaylistSong.query.filter_by(playlist_id=pl_id, song_id=song_id).first():
        db.session.add(PlaylistSong(playlist_id=pl_id, song_id=song_id))
        db.session.commit()
    return jsonify(pl_to_dict(Playlist.query.get(pl_id)))

# ── RUN ───────────────────────────────────────────────────────
if __name__ == "__main__":
    with app.app_context():
        db.create_all()
        auto_scan_on_startup() # <--- El escaneo ocurre aquí
    app.run(debug=True, host="0.0.0.0", port=5000)
