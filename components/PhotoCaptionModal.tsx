import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface PhotoCaptionModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (caption: string) => void;
  photoUrl?: string;
  eventTitle?: string;
  isLoading?: boolean;
}

export default function PhotoCaptionModal({
  visible,
  onClose,
  onSave,
  photoUrl,
  eventTitle,
  isLoading = false,
}: PhotoCaptionModalProps) {
  const [caption, setCaption] = useState('');

  const handleSave = () => {
    onSave(caption.trim());
    setCaption(''); // Reset caption after saving
  };

  const handleClose = () => {
    setCaption(''); // Reset caption when closing
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Caption</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading}
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          >
            <Text style={[styles.saveButtonText, isLoading && styles.saveButtonTextDisabled]}>
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

           {/* Event Info */}
           {eventTitle && (
            <View style={styles.eventInfo}>
              <Ionicons name="calendar" size={16} color={Colors.light.accent} />
              <Text style={styles.eventTitle}>{eventTitle}</Text>
            </View>
          )}

          {/* Photo Preview */}
          {photoUrl && (
            <View style={styles.photoContainer}>
              <Image
                source={{ uri: photoUrl }}
                style={styles.photo}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Caption Input */}
          <View style={styles.captionContainer}>
            <TextInput
              style={styles.captionInput}
              value={caption}
              onChangeText={setCaption}
              placeholder="Caption (optional)"
              placeholderTextColor={Colors.light.icon}
              multiline
              maxLength={500}
              textAlignVertical="top"
              autoFocus
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    fontFamily: 'Onest',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.light.accent,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.light.border,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Onest',
  },
  saveButtonTextDisabled: {
    color: Colors.light.icon,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  photoContainer: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.surfaceVariant,
  },
  photo: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  eventInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.surfaceVariant,
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.text,
    marginLeft: 8,
    fontFamily: 'Onest',
  },
  captionContainer: {
    marginBottom: 20,
  },
  captionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
    fontFamily: 'Onest',
  },
  captionInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.light.text,
    fontFamily: 'Onest',
    minHeight: 120,
    backgroundColor: Colors.light.surface,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.light.icon,
    textAlign: 'right',
    marginTop: 8,
    fontFamily: 'Onest',
  },
  previewInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.light.surfaceVariant,
    padding: 16,
    borderRadius: 12,
  },
  previewText: {
    fontSize: 14,
    color: Colors.light.text,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
    fontFamily: 'Onest',
  },
}); 