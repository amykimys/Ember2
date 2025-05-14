import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Switch, ScrollView, Animated,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';



type Category = {
    name: string;
    color: string;
  };
  
type EventFormProps = {
mode?: 'add' | 'edit';
title: string;
description: string;
category: Category | null;
categories: Category[];
onTitleChange: (text: string) => void;
onDescriptionChange: (text: string) => void;
onCategorySelect: () => void;
onAddCategory?: () => void;
newCategoryName: string;
setNewCategoryName: (val: string) => void;
newCategoryColor: string;
setNewCategoryColor: (val: string) => void;
startDateTime: Date;
endDateTime: Date;
isAllDay: boolean;
setIsAllDay: (val: boolean) => void;
onStartDateChange: (date: Date) => void;
onEndDateChange: (date: Date) => void;
showStartPicker: boolean;
showEndPicker: boolean;
setShowStartPicker: (val: boolean) => void;
setShowEndPicker: (val: boolean) => void;
reminderTime: Date | null;
setReminderTime: (val: Date | null) => void;
repeatOption: string;
setRepeatOption: (val: string) => void;
repeatEndDate: Date | null;
setRepeatEndDate: (val: Date | null) => void;
showReminderPicker: boolean;
showRepeatPicker: boolean;
showEndDatePicker: boolean;
setShowReminderPicker: (val: boolean) => void;
setShowRepeatPicker: (val: boolean) => void;
setShowEndDatePicker: (val: boolean) => void;
onDelete?: () => void;
onSave: () => void;
customSelectedDates: string[];
openCustomDatePicker: () => void;
isEditingEvent: boolean;
};


export default function EventForm(props: EventFormProps) {
    const {
      mode = 'add',
      title,
      description,
      category,
      categories,
      onTitleChange,
      onDescriptionChange,
      onCategorySelect,
      onAddCategory,
      newCategoryName,
      setNewCategoryName,
      newCategoryColor,
      setNewCategoryColor,
      startDateTime,
      endDateTime,
      isAllDay,
      setIsAllDay,
      onStartDateChange,
      onEndDateChange,
      showStartPicker,
      showEndPicker,
      setShowStartPicker,
      setShowEndPicker,
      reminderTime,
      setReminderTime,
      repeatOption,
      setRepeatOption,
      repeatEndDate,
      setRepeatEndDate,
      showReminderPicker,
      showRepeatPicker,
      showEndDatePicker,
      setShowReminderPicker,
      setShowRepeatPicker,
      setShowEndDatePicker,
      onDelete,
      onSave,
      customSelectedDates,
      openCustomDatePicker,
      isEditingEvent,
    } = props;
  
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
      {/* Title & Description */}
      <TextInput
        style={{ ...styles.inputTitle }}
        placeholder="Title"
        value={title}
        onChangeText={onTitleChange}
      />
      <TextInput
        style={{ ...styles.inputDescription }}
        placeholder="Description (optional)"
        value={description}
        onChangeText={onDescriptionChange}
        multiline
      />

      {/* Category Selection */}
      <View style={{ marginBottom: 12 }}>
        <Text style={styles.label}>Category</Text>
        <TouchableOpacity
          onPress={onCategorySelect}
          style={styles.categoryPickerButton}
        >
          {category ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
              <Text style={styles.categoryText}>{category.name}</Text>
            </View>
          ) : (
            <Text style={styles.categoryText}>Set Category</Text>
          )}
        </TouchableOpacity>
        {/* Add new category UI logic (optional) */}
      </View>

      {/* All-day Toggle */}
      <View style={styles.row}>
        <Text style={styles.label}>All-day event</Text>
        <Switch value={isAllDay} onValueChange={setIsAllDay} />
      </View>

      {/* Start & End Time */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Start</Text>
          <TouchableOpacity
            onPress={() => {
              setShowStartPicker(true);
              setShowEndPicker(false);
            }}
            style={styles.dateTimeButton}
          >
            <Text style={styles.dateText}>
              {startDateTime.toLocaleString([], {
                month: 'short',
                day: 'numeric',
                ...(isAllDay ? {} : { hour: 'numeric', minute: '2-digit', hour12: true }),
              }).replace(',', ' ·')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.label}>End</Text>
          <TouchableOpacity
            onPress={() => {
              setShowEndPicker(true);
              setShowStartPicker(false);
            }}
            style={styles.dateTimeButton}
          >
            <Text style={styles.dateText}>
              {endDateTime.toLocaleString([], {
                month: 'short',
                day: 'numeric',
                ...(isAllDay ? {} : { hour: 'numeric', minute: '2-digit', hour12: true }),
              }).replace(',', ' ·')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {(showStartPicker || showEndPicker) && (
        <Animated.View style={styles.pickerContainer}>
          <DateTimePicker
            value={showStartPicker ? startDateTime : endDateTime}
            mode={isAllDay ? 'date' : 'datetime'}
            display="spinner"
            onChange={(event, date) => {
              if (!date) return;
              showStartPicker ? onStartDateChange(date) : onEndDateChange(date);
            }}
            style={{ height: isAllDay ? 180 : 240 }}
            textColor="#333"
          />
        </Animated.View>
      )}

      {/* Reminder & Repeat */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Reminder</Text>
          <TouchableOpacity
            onPress={() => {
              setShowReminderPicker(!showReminderPicker);
              setShowRepeatPicker(false);
              setShowEndDatePicker(false);
            }}
            style={styles.dateTimeButton}
          >
            <Text style={styles.dateText}>
              {reminderTime
                ? reminderTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'No Reminder'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Repeat</Text>
          <TouchableOpacity
            onPress={() => {
              setShowRepeatPicker(!showRepeatPicker);
              setShowReminderPicker(false);
              setShowEndDatePicker(false);
            }}
            style={styles.dateTimeButton}
          >
            <Text style={styles.dateText}>
              {repeatOption === 'None' ? 'Do Not Repeat' : repeatOption}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Save & Delete */}
      <View style={styles.modalActions}>
        {mode === 'edit' && (
          <TouchableOpacity onPress={onDelete} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onSave} style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Define shared styles for reuse
const styles = StyleSheet.create({
    inputTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#ccc',
    fontFamily: 'Onest',
  },
  inputDescription: {
    fontSize: 14,
    marginBottom: 12,
    fontFamily: 'Onest',
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    color: '#3a3a3a',
    fontFamily: 'Onest',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  categoryText: {
    fontSize: 13,
    fontFamily: 'Onest',
    color: '#3a3a3a',
    fontWeight: '500',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  categoryPickerButton: {
    backgroundColor: '#fafafa',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 13,
    fontFamily: 'Onest',
    color: '#3a3a3a',
    fontWeight: '500',
  },
  dateTimeButton: {
    backgroundColor: '#fafafa',
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  pickerContainer: {
    marginTop: 10,
    backgroundColor: '#fafafa',
    borderRadius: 16,
    padding: 8,
  },
  modalActions: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  deleteButton: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#d32f2f',
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#FF9A8B',
    padding: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
