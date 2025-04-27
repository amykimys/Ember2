import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

interface CalendarEvent {
    id: string;
    title: string;
    description?: string;
    date: string;
    startDateTime?: Date;
    endDateTime?: Date;
    categoryName?: string;
    categoryColor?: string;
    reminderTime?: Date | null;
    repeatOption?: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Custom';
    repeatEndDate?: Date | null;
    isContinued?: boolean;
  }
  

interface EventModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  initialData?: Partial<CalendarEvent>;
  categories?: { id: string; name: string; color: string }[];
}

const EventModal: React.FC<EventModalProps> = ({
  visible,
  onClose,
  onSave,
  initialData = {},
  categories = [],
}) => {
  const [title, setTitle] = useState(initialData.title || '');
  const [description, setDescription] = useState(initialData.description || '');
  const [startDateTime, setStartDateTime] = useState(initialData.startDateTime || new Date());
  const [endDateTime, setEndDateTime] = useState(initialData.endDateTime || new Date(new Date().getTime() + 60 * 60 * 1000));
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string; color: string } | null>(null);
  const [reminderTime, setReminderTime] = useState<Date | null>(initialData.reminderTime || null);
  const [repeatOption, setRepeatOption] = useState(initialData.repeatOption || 'None');
  const [repeatEndDate, setRepeatEndDate] = useState<Date | null>(initialData.repeatEndDate || null);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showRepeatPicker, setShowRepeatPicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  

  useEffect(() => {
    if (initialData?.startDateTime) {
      setStartDateTime(new Date(initialData.startDateTime));
    }
    if (initialData?.endDateTime) {
      setEndDateTime(new Date(initialData.endDateTime));
    }
    if (initialData?.title !== undefined) {
      setTitle(initialData.title);
    }
    if (initialData?.description !== undefined) {
      setDescription(initialData.description);
    }
  }, [initialData]);
  
  

  const handleSave = () => {
    if (!title.trim()) return;

    const newEvent: CalendarEvent = {
      ...initialData,
      id: initialData.id || Date.now().toString(),
      title,
      description,
      startDateTime,
      endDateTime,
      date: startDateTime.toISOString().split('T')[0],
      categoryName: selectedCategory?.name || '',
      categoryColor: selectedCategory?.color || '',
      reminderTime,
      repeatOption,
      repeatEndDate,
      isContinued: false,
    };

    onSave(newEvent);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <ScrollView
                contentContainerStyle={{ paddingBottom: 40 }}
                keyboardShouldPersistTaps="handled"
              >
                <View>
                <Text style={styles.modalTitle}>Add Event</Text>
                
                <Text style={styles.modalSubtitle}>
                    {startDateTime.toLocaleDateString('en-US', {
                    weekday: 'long',  // Tuesday
                    month: 'short',   // May
                    day: 'numeric',   // 7
                    year: 'numeric',  // 2025
                    })}
                </Text>
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Title"
                  value={title}
                  onChangeText={setTitle}
                />
                <TextInput
                  style={[styles.input, { height: 80 }]}
                  placeholder="Description (optional)"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />

                {/* Start Time */}
                <TouchableOpacity onPress={() => setShowStartPicker(!showStartPicker)} style={styles.inlineRow}>
                  <Ionicons name="play-outline" size={22} color="#666" />
                  <Text style={styles.inlineText}>
                    {startDateTime.toLocaleString()}
                  </Text>
                </TouchableOpacity>
                {showStartPicker && (
                  <DateTimePicker
                    value={startDateTime}
                    mode="datetime"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setStartDateTime(selectedDate);
                      }
                      setShowStartPicker(false);
                    }}
                  />
                )}

                {/* End Time */}
                <TouchableOpacity onPress={() => setShowEndPicker(!showEndPicker)} style={styles.inlineRow}>
                  <Ionicons name="caret-back-outline" size={22} color="#666" />
                  <Text style={styles.inlineText}>
                    {endDateTime.toLocaleString()}
                  </Text>
                </TouchableOpacity>
                {showEndPicker && (
                  <DateTimePicker
                    value={endDateTime}
                    mode="datetime"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setEndDateTime(selectedDate);
                      }
                      setShowEndPicker(false);
                    }}
                  />
                )}

                {/* Category */}
                <TouchableOpacity onPress={() => {}} style={styles.inlineRow}>
                  <Ionicons name="color-palette-outline" size={22} color={selectedCategory?.color || '#666'} />
                  <Text style={[styles.inlineText, { color: selectedCategory?.color || '#000' }]}>
                    {selectedCategory ? selectedCategory.name : 'Set Category'}
                  </Text>
                </TouchableOpacity>

                {/* Reminder */}
                <TouchableOpacity onPress={() => setShowReminderPicker(!showReminderPicker)} style={styles.inlineRow}>
                  <Ionicons name="time-outline" size={22} color="#666" />
                  <Text style={styles.inlineText}>
                    {reminderTime ? reminderTime.toLocaleTimeString() : 'Set Reminder'}
                  </Text>
                </TouchableOpacity>
                {showReminderPicker && (
                  <DateTimePicker
                    value={reminderTime || new Date()}
                    mode="time"
                    display="spinner"
                    onChange={(event, selectedTime) => {
                      if (selectedTime) {
                        setReminderTime(selectedTime);
                      }
                      setShowReminderPicker(false);
                    }}
                  />
                )}

                {/* Repeat */}
                <TouchableOpacity onPress={() => setShowRepeatPicker(!showRepeatPicker)} style={styles.inlineRow}>
                  <Ionicons name="repeat" size={22} color="#666" />
                  <Text style={styles.inlineText}>
                    {repeatOption !== 'None' ? repeatOption : 'Set Repeat'}
                  </Text>
                </TouchableOpacity>

                {/* End Date */}
                {repeatOption !== 'None' && (
                  <TouchableOpacity onPress={() => setShowEndDatePicker(!showEndDatePicker)} style={styles.inlineRow}>
                    <Ionicons name="calendar-outline" size={22} color="#666" />
                    <Text style={styles.inlineText}>
                      {repeatEndDate ? `Until ${repeatEndDate.toLocaleDateString()}` : 'Set End Date'}
                    </Text>
                  </TouchableOpacity>
                )}
                {showEndDatePicker && (
                  <DateTimePicker
                    value={repeatEndDate || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        setRepeatEndDate(selectedDate);
                      }
                      setShowEndDatePicker(false);
                    }}
                  />
                )}
              </ScrollView>

              <View style={styles.modalActions}>
                <TouchableOpacity onPress={onClose}>
                  <Text style={styles.cancel}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave}>
                  <Text style={styles.save}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 10, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 10 },
  input: { borderWidth: 0.5, borderColor: '#ccc', borderRadius: 6, padding: 10, marginBottom: 12 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  inlineText: { fontSize: 16, marginLeft: 10, color: '#333' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  cancel: { fontSize: 16, color: '#666' },
  save: { fontSize: 16, color: '#007AFF', fontWeight: '600' },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    textAlign: 'center',
    alignSelf: 'flex-start',
  }
  
});

export default EventModal;
