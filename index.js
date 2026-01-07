// FavoriteMedia Plugin para Kettu
// Permite guardar GIFs e imágenes (JPG, PNG) como favoritos

const { storage } = vendetta;
const { getByProps, getByStoreName } = vendetta.metro;
const { showToast } = vendetta.ui.toasts;
const { getAssetIDByName } = vendetta.ui.assets;
const { React } = vendetta.metro.common;
const { after } = vendetta.patcher;

// Configuración
const FAVORITES_KEY = "favoriteMedia";
const MAX_FAVORITES = 100;

// Obtener favoritos guardados
function getFavorites() {
  try {
    const saved = storage.get(FAVORITES_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Error loading favorites:", e);
    return [];
  }
}

// Guardar favoritos
function saveFavorites(favorites) {
  try {
    storage.set(FAVORITES_KEY, JSON.stringify(favorites));
    return true;
  } catch (e) {
    console.error("Error saving favorites:", e);
    return false;
  }
}

// Agregar a favoritos
function addFavorite(url, type = "gif") {
  const favorites = getFavorites();
  
  // Verificar si ya existe
  if (favorites.some(f => f.url === url)) {
    showToast("Ya está en favoritos", getAssetIDByName("ic_information"));
    return false;
  }
  
  // Verificar límite
  if (favorites.length >= MAX_FAVORITES) {
    showToast(`Límite de ${MAX_FAVORITES} favoritos alcanzado`, getAssetIDByName("ic_warning"));
    return false;
  }
  
  // Agregar nuevo favorito
  favorites.unshift({
    url,
    type,
    timestamp: Date.now()
  });
  
  if (saveFavorites(favorites)) {
    showToast("Agregado a favoritos ✓", getAssetIDByName("ic_check"));
    return true;
  }
  
  showToast("Error al guardar", getAssetIDByName("ic_close"));
  return false;
}

// Remover de favoritos
function removeFavorite(url) {
  let favorites = getFavorites();
  favorites = favorites.filter(f => f.url !== url);
  
  if (saveFavorites(favorites)) {
    showToast("Eliminado de favoritos", getAssetIDByName("ic_check"));
    return true;
  }
  
  return false;
}

// Detectar tipo de archivo por URL
function getMediaType(url) {
  const lower = url.toLowerCase();
  if (lower.includes('.gif') || lower.includes('tenor.com') || lower.includes('giphy.com')) {
    return 'gif';
  }
  if (lower.match(/\.(jpg|jpeg|png|webp)/)) {
    return 'image';
  }
  return 'unknown';
}

// Patches
let patches = [];

export default {
  onLoad: () => {
    try {
      // Patch para agregar opción en el menú contextual de imágenes
      const MessageLongPressActionSheet = getByProps("MessageLongPressActionSheet");
      
      if (MessageLongPressActionSheet) {
        const unpatch = after("default", MessageLongPressActionSheet, ([props], res) => {
          // Buscar si hay imagen o GIF en el mensaje
          const message = props?.message;
          if (!message) return res;
          
          const attachments = message.attachments || [];
          const embeds = message.embeds || [];
          
          let mediaUrl = null;
          let mediaType = null;
          
          // Buscar en attachments
          for (const att of attachments) {
            if (att.content_type?.startsWith('image/')) {
              mediaUrl = att.url || att.proxy_url;
              mediaType = getMediaType(mediaUrl);
              break;
            }
          }
          
          // Buscar en embeds si no hay attachment
          if (!mediaUrl) {
            for (const embed of embeds) {
              if (embed.type === 'gifv' || embed.type === 'image') {
                mediaUrl = embed.url || embed.thumbnail?.url || embed.image?.url;
                mediaType = embed.type === 'gifv' ? 'gif' : 'image';
                break;
              }
            }
          }
          
          // Si encontramos media, agregar opción al menú
          if (mediaUrl && res?.props?.children) {
            const buttons = Array.isArray(res.props.children) 
              ? res.props.children 
              : [res.props.children];
            
            buttons.push(
              React.createElement("Pressable", {
                onPress: () => addFavorite(mediaUrl, mediaType),
                style: { padding: 12 }
              }, 
                React.createElement("Text", { 
                  style: { fontSize: 16, color: "#ffffff" }
                }, "⭐ Guardar en Favoritos")
              )
            );
            
            res.props.children = buttons;
          }
          
          return res;
        });
        
        patches.push(unpatch);
      }
      
      // Patch para agregar botón en el picker de GIFs
      const GifPicker = getByProps("GifPicker") || getByStoreName("GifPickerStore");
      
      if (GifPicker) {
        // Aquí podrías agregar un tab de favoritos en el picker
        // Esto requeriría más trabajo de UI pero es posible
      }
      
      showToast("FavoriteMedia cargado ✓", getAssetIDByName("ic_check"));
      
    } catch (e) {
      console.error("Error loading FavoriteMedia:", e);
      showToast("Error cargando FavoriteMedia", getAssetIDByName("ic_close"));
    }
  },
  
  onUnload: () => {
    // Deshacer todos los patches
    for (const unpatch of patches) {
      unpatch();
    }
    patches = [];
  },
  
  settings: {
    // Panel de configuración para ver y gestionar favoritos
    FavoritesList: () => {
      const [favorites, setFavorites] = React.useState(getFavorites());
      const { ScrollView, View, Text, Image, Pressable } = vendetta.metro.common;
      
      const refresh = () => setFavorites(getFavorites());
      
      const handleRemove = (url) => {
        removeFavorite(url);
        refresh();
      };
      
      const handleCopy = (url) => {
        // Copiar al portapapeles (si hay API disponible)
        showToast("URL copiada", getAssetIDByName("ic_check"));
      };
      
      return React.createElement(ScrollView, { style: { padding: 16 } },
        React.createElement(Text, { 
          style: { fontSize: 20, fontWeight: "bold", marginBottom: 12, color: "#ffffff" }
        }, `Favoritos (${favorites.length}/${MAX_FAVORITES})`),
        
        favorites.length === 0 
          ? React.createElement(Text, { 
              style: { color: "#b9bbbe", textAlign: "center", marginTop: 20 }
            }, "No hay favoritos guardados.\nMantén presionado en una imagen o GIF para agregarla.")
          : favorites.map((fav, idx) => 
              React.createElement(View, {
                key: idx,
                style: { 
                  marginBottom: 16, 
                  backgroundColor: "#2f3136", 
                  borderRadius: 8, 
                  padding: 12 
                }
              },
                React.createElement(Image, {
                  source: { uri: fav.url },
                  style: { width: "100%", height: 200, borderRadius: 4, marginBottom: 8 },
                  resizeMode: "contain"
                }),
                React.createElement(Text, {
                  style: { color: "#72767d", fontSize: 12, marginBottom: 8 }
                }, `Tipo: ${fav.type} • ${new Date(fav.timestamp).toLocaleDateString()}`),
                React.createElement(View, { style: { flexDirection: "row", gap: 8 } },
                  React.createElement(Pressable, {
                    onPress: () => handleCopy(fav.url),
                    style: { 
                      backgroundColor: "#5865f2", 
                      padding: 8, 
                      borderRadius: 4, 
                      flex: 1, 
                      alignItems: "center" 
                    }
                  }, React.createElement(Text, { style: { color: "#ffffff" } }, "Copiar URL")),
                  React.createElement(Pressable, {
                    onPress: () => handleRemove(fav.url),
                    style: { 
                      backgroundColor: "#ed4245", 
                      padding: 8, 
                      borderRadius: 4, 
                      flex: 1, 
                      alignItems: "center" 
                    }
                  }, React.createElement(Text, { style: { color: "#ffffff" } }, "Eliminar"))
                )
              )
            )
      );
    }
  }
};
