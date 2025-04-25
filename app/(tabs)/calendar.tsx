import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Platform, 
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';

interface CalendarEvent {
  title: string;
  description?: string;
}


const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const CELL_WIDTH = SCREEN_WIDTH / 7;
const CELL_HEIGHT = (SCREEN_HEIGHT - 140) / 6;

const NUM_COLUMNS = 7;
const NUM_ROWS = 6;

const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const generateMonthKey = (year: number, month: number) => `${year}-${month}`;

const CalendarScreen: React.FC = () => {
  const today = new Date();
  const currentMonthIndex = 12; // center month in 25-month buffer
  const flatListRef = useRef<FlatList>(null);

  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<{ [date: string]: CalendarEvent[] }>({});
  const [showModal, setShowModal] = useState(false);
  const [newEventText, setNewEventText] = useState('');
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showDateSettings, setShowDateSettings] = useState(false);
    
  const getMonthData = (baseDate: Date, offset: number) => {
    const newDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
    const year = newDate.getFullYear();
    const month = newDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    while (days.length < NUM_COLUMNS * NUM_ROWS) days.push(null);
    return { key: generateMonthKey(year, month), year, month, days };
  };

  const months = Array.from({ length: 25 }, (_, i) => getMonthData(today, i - 12));

  const isToday = (date: Date | null) =>
    date?.toDateString() === new Date().toDateString();

  const isSelected = (date: Date | null) =>
    date?.toDateString() === selectedDate.toDateString();

  const renderCell = (date: Date | null, index: number) => {
    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.cell,
          isSelected(date) && styles.selectedCell,
          isToday(date) && styles.todayCell
        ]}
        onPress={() => date && setSelectedDate(date)}
        activeOpacity={date ? 0.7 : 1}
        disabled={!date}
      >
        <Text
          style={[
            styles.dateNumber,
            !date && styles.invisibleText,
            isSelected(date) && styles.selectedText,
            isToday(date) && styles.todayText
          ]}
        >
          {date?.getDate()}
        </Text>

        {date &&
  events[date.toISOString().split('T')[0]]?.map((event, idx) => (
    <Text key={idx} numberOfLines={1} style={styles.eventText}>
      • {event.title}: {event.description}
    </Text>
  ))}



        {/* Example dot */}
        {date?.getDate() === 10 && (
          <View style={styles.dotContainer}>
            <View style={styles.dot} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderMonth = ({ item }: { item: ReturnType<typeof getMonthData> }) => {
    const { year, month, days } = item;
    const label = new Date(year, month).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  
    return (
      <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, paddingTop: 1 }}>
        <Text style={styles.monthLabel}>{label}</Text>
        <View style={styles.weekRow}>
          {weekdays.map((day, idx) => (
            <Text key={idx} style={styles.weekday}>
              {day}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {days.map((date, i) => renderCell(date, i))}
        </View>
      </View>
    );
    
  };
  
  return (
    <>
      <SafeAreaView style={{ flex: 1 }}>
        <FlatList
          ref={flatListRef}
          data={months}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          initialScrollIndex={currentMonthIndex}
          contentContainerStyle={{ flexGrow: 1 }}
          renderItem={renderMonth}
          getItemLayout={(_, index) => ({
            length: SCREEN_WIDTH,
            offset: SCREEN_WIDTH * index,
            index
          })}
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        />
  
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          style={styles.addButton}
        >
          <Text style={styles.addIcon}>＋</Text>
        </TouchableOpacity>
      </SafeAreaView>
  
      <Modal
  animationType="slide"
  transparent={true}
  visible={showModal}
  onRequestClose={() => setShowModal(false)}
>
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    style={{ flex: 1 }}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
  >
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Add Event</Text>
          <Text style={styles.modalSubtitle}>{selectedDate.toDateString()}</Text>

          <TextInput
            style={styles.inputTitle}
            placeholder="Title"
            value={newEventTitle}
            onChangeText={setNewEventTitle}
          />

          <TextInput
            style={styles.inputDescription}
            placeholder="Description (optional)"
            value={newEventDescription}
            onChangeText={setNewEventDescription}
            multiline
          />

          {/* Quick Action Row */}
          <View style={styles.quickActionRow}>
            {/* Category Icon */}
            <TouchableOpacity onPress={() => setShowCategoryPicker(true)}>
              <Ionicons name="folder-outline" size={22} color="#666" />
            </TouchableOpacity>

            {/* Calendar Icon for Reminder and Repeat */}
            <TouchableOpacity onPress={() => setShowDateSettings(true)}>
              <Ionicons name="calendar-outline" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Actions */}
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                const key = selectedDate.toISOString().split('T')[0];
                const newEvents = { ...events };
                if (!newEvents[key]) newEvents[key] = [];
                newEvents[key].push({
                  title: newEventTitle,
                  description: newEventDescription,
                });
                setEvents(newEvents);
                setNewEventTitle('');
                setNewEventDescription('');
                setShowModal(false);
              }}
            >
              <Text style={styles.save}>Save</Text>
            </TouchableOpacity>

          </View>
        </View>
      </View>
    </TouchableWithoutFeedback>
  </KeyboardAvoidingView>
</Modal>

    </>
  );
  
};

const styles = StyleSheet.create({
  monthLabel: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 30,
    color: '#333',
  },
  weekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  weekday: {
    width: CELL_WIDTH,
    textAlign: 'center',
    fontWeight: '600',
    color: '#777',
    paddingBottom: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: CELL_WIDTH,
    height: CELL_HEIGHT + 12,
    paddingTop: 6,
    paddingLeft: 6,
    borderWidth: 0.5,
    borderColor: '#eee',
  },
  dateNumber: {
    fontSize: 16,
    color: '#333',
  },
  selectedCell: {
    backgroundColor: '#007AFF20',
  },
  todayCell: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  selectedText: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  todayText: {
    fontWeight: 'bold',
    color: '#007AFF',
  },
  invisibleText: {
    color: 'transparent',
  },
  dotContainer: {
    marginTop: 4,
    paddingLeft: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#007AFF',
  },
  addButton: {
    position: 'absolute',
    right: 22,
    bottom: 82,
    backgroundColor: '#BF9264',
    borderRadius: 28,
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  addIcon: {
    fontSize: 30,
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancel: {
    fontSize: 16,
    color: '#666',
  },
  save: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  eventText: {
    fontSize: 10,
    color: '#333',
    marginTop: 2,
    paddingRight: 2,
  },
  inputTitle: {
    fontSize: 16,
    padding: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 10,
  },
  
  inputDescription: {
    fontSize: 14,
    padding: 12,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    height: 80,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  
});

export default CalendarScreen;
