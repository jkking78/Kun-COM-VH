import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Image
} from 'react-native';

const POPULAR_HASHTAGS = [
  { id: 'cadrage', tag: '#Cadrage' },
  { id: 'regie', tag: '#Régie' },
  { id: 'web', tag: '#Web' },
  { id: 'proj', tag: '#Projection' },
  { id: 'prod', tag: '#Prod' },
  { id: 'photo', tag: '#Photo' },
  { id: 'vente', tag: '#Vente' },
  { id: 'culte', tag: '#CulteDuDimanche' },
  { id: 'chorale', tag: '#Chorale' },
];

export default function CreatePostModal({ visible, onClose, onSubmitPost }) {
  const [postText, setPostText] = useState('');
  const [mediaUrls, setMediaUrls] = useState([]);
  const [showHashtagSuggestions, setShowHashtagSuggestions] = useState(false);

  const handleTextChange = (text) => {
    setPostText(text);
    const words = text.split(/\s/);
    const lastWord = words[words.length - 1];
    if (lastWord.startsWith('#')) {
      setShowHashtagSuggestions(true);
    } else {
      setShowHashtagSuggestions(false);
    }
  };

  const handleSelectHashtag = (tagStr) => {
    const words = postText.split(/\s/);
    words.pop();
    const updatedText = [...words, tagStr, ''].join(' ');
    setPostText(updatedText);
    setShowHashtagSuggestions(false);
  };

  // GESTION DE L'IMPORTATION DE FICHIERS MULTIPLES
  const handleFileChange = (e) => {
    if (e.target && e.target.files) {
      const files = Array.from(e.target.files);
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setMediaUrls(prev => [...prev, reader.result]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemoveMedia = (index) => {
    setMediaUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!postText.trim() && mediaUrls.length === 0) return;

    let detectedSectionId = 'general';
    const sectionTags = ['cadrage', 'regie', 'web', 'proj', 'prod', 'photo', 'vente'];
    for (let secId of sectionTags) {
      if (postText.toLowerCase().includes(`#${secId}`)) {
        detectedSectionId = secId;
        break;
      }
    }

    onSubmitPost(postText, detectedSectionId, mediaUrls);
    setPostText('');
    setMediaUrls([]);
    setShowHashtagSuggestions(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
          <SafeAreaView style={{width: '100%'}}>
            
            {/* EN-TÊTE NETTOYÉ SANS DROPDOWN DE SECTION */}
            <View style={styles.header}>
              <Text style={styles.title}>Créer une publication</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeText}>Annuler</Text>
              </TouchableOpacity>
            </View>

            {/* SUGGESTIONS DE HASHTAGS */}
            {showHashtagSuggestions && (
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Suggestions :</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
                  {POPULAR_HASHTAGS.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.suggestionChip}
                      onPress={() => handleSelectHashtag(item.tag)}
                    >
                      <Text style={styles.suggestionChipText}>{item.tag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <TextInput
              style={styles.textInput}
              multiline
              placeholder="Rédigez votre message... Tapez # pour identifier une section (ex: #Cadrage, #Chorale)"
              placeholderTextColor="#8E8E93"
              value={postText}
              onChangeText={handleTextChange}
            />

            {/* PRÉVISUALISATION DES VIGNETTES D'IMAGES SÉLECTIONNÉES */}
            {mediaUrls.length > 0 && (
              <View style={styles.previewContainer}>
                <Text style={styles.previewTitle}>Photos sélectionnées ({mediaUrls.length}) :</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.previewScroll}>
                  {mediaUrls.map((url, idx) => (
                    <View key={idx} style={styles.thumbnailWrapper}>
                      <Image source={{ uri: url }} style={styles.thumbnailImage} />
                      <TouchableOpacity style={styles.removeMediaBtn} onPress={() => handleRemoveMedia(idx)}>
                        <Text style={styles.removeMediaText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* BOUTON D'IMPORTATION DE PHOTOS MULTIPLES */}
            <View style={styles.filePickerContainer}>
              <label style={styles.filePickerLabel}>
                📷 Ajouter des photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </label>
            </View>

            <TouchableOpacity style={styles.publishBtn} onPress={handleSubmit}>
              <Text style={styles.publishBtnText}>Publier sur le Feed</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  suggestionsContainer: {
    backgroundColor: '#F0F6FF',
    padding: 10,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#D0E3FF',
  },
  suggestionsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  suggestionsScroll: {
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  suggestionChipText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  textInput: {
    width: '100%',
    minHeight: 90,
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    padding: 14,
    fontSize: 14,
    color: '#000000',
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  previewContainer: {
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 6,
  },
  previewScroll: {
    gap: 10,
  },
  thumbnailWrapper: {
    width: 64,
    height: 64,
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeMediaText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  filePickerContainer: {
    marginBottom: 14,
  },
  filePickerLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F6FF',
    color: '#007AFF',
    padding: '10px 16px',
    borderRadius: '12px',
    fontSize: '13.5px',
    fontWeight: '700',
    cursor: 'pointer',
    border: '1px solid #D0E3FF',
    width: '100%',
    boxSizing: 'border-box',
  },
  publishBtn: {
    width: '100%',
    height: 48,
    backgroundColor: '#007AFF',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  publishBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
