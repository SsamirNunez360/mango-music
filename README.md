# 🥭 Mango Music

> *No es Apple Music. Es mejor. (Casi.)*

Una parodia de Apple Music construida con Flask + SQLite. Reproduce tus MP3 locales con una interfaz limpia, playlists, letras y más.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python)
![Flask](https://img.shields.io/badge/Flask-3.0-lightgrey?logo=flask)
![SQLite](https://img.shields.io/badge/SQLite-3-blue?logo=sqlite)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ Funciones

- 🎵 **Reproductor completo** — play/pause, anterior/siguiente, seek, volumen
- ⬆ **Subir MP3 al servidor** — drag & drop o selector de archivos
- 📖 **Metadatos automáticos** — lee el título, artista y álbum del ID3 tag
- 📋 **Playlists** — crea, edita y elimina playlists
- ❤️ **Favoritas** — marca tus canciones favoritas
- 🎤 **Letras** — escribe y guarda la letra de cada canción
- 🔍 **Búsqueda** — filtra por título, artista o álbum
- ⇄ **Shuffle & Repeat** — modos aleatorio y repetición
- 🔔 **Toasts** — notificaciones de acciones

---

## 🚀 Instalación rápida

### 1. Clona el repositorio

```bash
git clone https://github.com/TU_USUARIO/mango-music.git
cd mango-music
```

### 2. Crea un entorno virtual

```bash
python -m venv venv

# Linux / macOS
source venv/bin/activate

# Windows
venv\Scripts\activate
```

### 3. Instala dependencias

```bash
pip install -r requirements.txt
```

### 4. Crea la carpeta de uploads

```bash
mkdir -p static/uploads
```

### 5. Ejecuta la app

```bash
python app.py
```

Abre tu navegador en **http://localhost:5000** 🥭

---

## 📁 Estructura del proyecto

```
mango-music/
├── app.py              # Servidor Flask + rutas API
├── database.py         # Modelos SQLAlchemy (Song, Playlist)
├── requirements.txt    # Dependencias Python
├── mango.db            # Base de datos SQLite (se crea automáticamente)
├── static/
│   ├── css/
│   │   └── style.css   # Estilos principales
│   ├── js/
│   │   └── app.js      # Lógica del frontend
│   └── uploads/        # Archivos MP3 subidos (ignorado en git)
└── templates/
    └── index.html      # Template principal (Jinja2)
```

---

## 🌐 API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/songs` | Lista todas las canciones |
| `GET` | `/api/songs/<id>` | Detalle de una canción |
| `POST` | `/api/songs/upload` | Subir uno o varios MP3 |
| `PATCH` | `/api/songs/<id>` | Editar título, artista, letra, liked |
| `DELETE` | `/api/songs/<id>` | Eliminar canción del servidor |
| `GET` | `/api/playlists` | Lista todas las playlists |
| `POST` | `/api/playlists` | Crear playlist |
| `DELETE` | `/api/playlists/<id>` | Eliminar playlist |
| `POST` | `/api/playlists/<id>/songs` | Agregar canción a playlist |
| `DELETE` | `/api/playlists/<id>/songs/<sid>` | Quitar canción de playlist |
| `GET` | `/stream/<id>` | Stream del archivo de audio |

---

## ⚙️ Variables de entorno

| Variable | Default | Descripción |
|----------|---------|-------------|
| `SECRET_KEY` | `mango-secret-dev-key` | Clave secreta de Flask |
| `FLASK_DEBUG` | `True` | Modo debug |

Para producción, creá un archivo `.env`:

```env
SECRET_KEY=una-clave-muy-segura-aqui
FLASK_DEBUG=False
```

---

## 🛠 Tecnologías

- **Backend**: Python 3.10+, Flask 3, SQLAlchemy, Mutagen
- **Base de datos**: SQLite (sin configuración extra)
- **Frontend**: HTML5, CSS3, JavaScript puro (sin frameworks)
- **Audio**: Web Audio API nativa del navegador

---

## 📝 Licencia

MIT — libre para usar, modificar y compartir.

---

*Hecho con 🥭 y mucho amor tropical.*
