from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class Song(db.Model):
    __tablename__ = "songs"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    artist = db.Column(db.String(255), default="Artista desconocido")
    album = db.Column(db.String(255), default="—")
    duration = db.Column(db.Float, default=0.0)
    filename = db.Column(db.String(512), nullable=False, unique=True)
    liked = db.Column(db.Boolean, default=False)
    lyrics = db.Column(db.Text, default="")
    added_at = db.Column(db.DateTime, default=datetime.utcnow)

    playlist_entries = db.relationship("PlaylistSong", back_populates="song", cascade="all, delete-orphan")


class Playlist(db.Model):
    __tablename__ = "playlists"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    entries = db.relationship("PlaylistSong", back_populates="playlist", cascade="all, delete-orphan")


class PlaylistSong(db.Model):
    __tablename__ = "playlist_songs"

    id = db.Column(db.Integer, primary_key=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey("playlists.id"), nullable=False)
    song_id = db.Column(db.Integer, db.ForeignKey("songs.id"), nullable=False)

    playlist = db.relationship("Playlist", back_populates="entries")
    song = db.relationship("Song", back_populates="playlist_entries")
