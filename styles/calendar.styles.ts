import { StyleSheet, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TOTAL_HORIZONTAL_PADDING = 16; // 8 left + 8 right
const SIDE_PADDING = TOTAL_HORIZONTAL_PADDING / 2; // 8px left or right individually
const SCREEN_HEIGHT = Dimensions.get('window').height;
const BASE_CELL_HEIGHT = Math.max((SCREEN_HEIGHT - 180) / 6, 100);
const CELL_WIDTH = (SCREEN_WIDTH - TOTAL_HORIZONTAL_PADDING) / 7;

// Function to determine if a month needs 6 rows
const needsSixRows = (year: number, month: number) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  return daysInMonth + firstDayOfMonth > 35;
};

// Get cell height based on whether the month needs 6 rows
const getCellHeight = (date: Date | null, isCompact: boolean = false) => {
  if (!date) return BASE_CELL_HEIGHT;

  if (isCompact) {
    return BASE_CELL_HEIGHT * 0.45;
  }

  return needsSixRows(date.getFullYear(), date.getMonth())
    ? BASE_CELL_HEIGHT * 0.7  // 30% shorter for 6-row months in expanded view
    : BASE_CELL_HEIGHT;
};

export const calendarStyles = StyleSheet.create({
  // Header styles
  monthLabel: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#333',
    fontFamily: 'Onest',
  },
  headerRow: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', 
    paddingHorizontal: 23,
    marginVertical: 1,
    backgroundColor: 'white',
    zIndex: 1,
    marginTop: 15,
    marginBottom: 22
  },

  // Calendar grid styles
  weekRow: {
    flexDirection: 'row',
    backgroundColor: 'white',
  },
  weekday: {
    width: CELL_WIDTH,
    textAlign: 'center',
    color: '#333',
    paddingBottom: 4,
    fontSize: 14,
    fontFamily: 'Onest',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'white',
    paddingHorizontal: 0,
    position: 'relative',
    overflow: 'visible',
    rowGap: 12,
  },
  gridSixRows: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'white',
    paddingHorizontal: 0,
    position: 'relative',
    overflow: 'visible',
    rowGap: 0,
  },
  gridCompact: {
    paddingTop: 5,
    height: getCellHeight(new Date()) * 5,
    overflow: 'hidden',
  },

  // Cell styles
  cell: {
    width: CELL_WIDTH,
    paddingTop: 2,
    paddingLeft: 2,
    paddingRight: 2,
    borderColor: '#eee',
    backgroundColor: 'white',
    overflow: 'visible',
    zIndex: 0,
  },
  cellContent: {
    flex: 1,
    alignItems: 'center',
  },
  cellExpanded: {
    height: BASE_CELL_HEIGHT + 3.7,
  },
  cellExpandedSixRows: {
    height: BASE_CELL_HEIGHT * 0.9 + 4,
  },
  cellCompact: {
    height: BASE_CELL_HEIGHT * 0.435,
    marginBottom: 1,
    paddingTop: 1,
  },
  selectedCell: {
    borderColor: '#BF9264',
  },
  todayCell: {
    backgroundColor: 'transparent',
  },

  // Date styles
  dateContainer: {
    alignItems: 'center',
    marginBottom: 0,
    height: 25,
    width: 25,
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 12.5,
  },
  dateNumber: {
    fontSize: 15,
    color: '#3A3A3A',
    fontFamily: 'Onest',
    textAlign: 'center',
  },
  todayContainer: {
    backgroundColor: '#FAF9F6',
  },
  selectedContainer: {
    backgroundColor: '#A0C3B2',
  },
  todayText: {
    color: '#A0C3B2',
    fontWeight: '500',
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  adjacentMonthDate: {
    color: '#CCCCCC',
  },

  // Event styles
  eventBox: {
    flexDirection: 'column',
    justifyContent: 'flex-start', 
    alignItems: 'center',
    marginTop: 3,
    width: '100%',
    paddingHorizontal: 0,
    minHeight: 0,
    flex: 1,
    gap: 2
  },
  eventBoxText: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  eventDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
    height: 8,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventText: {
    fontSize: 12,
    color: '#3A3A3A',
    flex: 1,
    fontFamily: 'Onest',
    textAlign: 'center',
  },

  // Button styles
  addButton: {
    position: 'absolute',
    right: 16,
    top: 58,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },

  // Layout helpers
  dateHeader: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  dateHeaderText: {
    fontSize: 24,
    fontWeight: '500',
    color: '#333',
    fontFamily: 'Onest',
    paddingLeft: 12,
  },

  // Modal styles
  modalCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  modalInput: {
    fontSize: 17,
    fontFamily: 'Onest',
    fontWeight: '500',
    marginBottom: 5,
  },
  modalInputDescription: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Onest',
    fontWeight: '400',
    marginTop: 5,
    paddingVertical: 2,
    paddingHorizontal: 0,
    textAlignVertical: 'top',
  },
  modalInputLocation: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Onest',
    fontWeight: '400',
    marginTop: 8,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  modalLabel: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  modalToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -5,
    marginBottom: 12,
    paddingVertical: 0,
  },
  modalTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  modalTimeButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  modalTimeButtonFocused: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  modalTimeText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  modalPickerContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 6,
    marginTop: 10,
  },
  modalCategoryButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  modalCategoryButtonFocused: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  modalCategoryText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  modalCategoryPlaceholder: {
    fontSize: 14,
    color: '#999',
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  modalCategoryPicker: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    maxHeight: 170,
  },
  modalCategoryOption: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginBottom: 1,
  },
  modalCategoryOptionSelected: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#007AFF20',
    marginBottom: 1,
  },
  modalCategoryOptionText: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  modalCategoryOptionTextSelected: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest',
    fontWeight: '600',
  },
  modalAddCategoryForm: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  modalAddCategoryInput: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    fontSize: 14,
    fontFamily: 'Onest',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalColorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  modalColorOption: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalColorOptionSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
  },
  modalFormButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  modalFormButtonPrimary: {
    backgroundColor: '#007AFF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  modalFormButtonText: {
    color: '#666',
    fontSize: 14,
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  modalFormButtonTextPrimary: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Onest',
    fontWeight: '600',
  },
  modalDeleteButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  modalDeleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Onest',
    fontWeight: '600',
  },

  // Additional reusable modal styles
  modalSectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    fontFamily: 'Onest',
  },
  modalCategoryChip: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalCategoryChipSelected: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalCategoryChipText: {
    color: '#333',
    fontSize: 12,
    fontFamily: 'Onest',
    fontWeight: '500',
  },
  modalCategoryChipTextSelected: {
    color: '#333',
    fontSize: 12,
    fontFamily: 'Onest',
    fontWeight: '600',
  },
  modalCategoryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  modalCategoryDotLarge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  modalAddButton: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalFormSectionTitle: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest',
    fontWeight: '600',
    marginBottom: 8,
  },
  modalFormSubtitle: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'Onest',
    fontWeight: '500',
    marginBottom: 6,
  },

  // Layout helper styles
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalRowGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 6,
  },
  modalGapContainer: {
    gap: 8,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Onest',
  },
  modalHeaderButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Time box styles
  timeBoxContainer: {
    marginBottom: 16,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    padding: 12
  },
  timeBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  timeBoxDateText: {
    fontSize: 13,
    color: '#666',
    fontFamily: 'Onest'
  },
  timeBoxTimeContainer: {
    flexDirection: 'row',
    gap: 12
  },
  timeBoxTimeButton: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee'
  },
  timeBoxTimeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontFamily: 'Onest'
  },
  timeBoxTimeValue: {
    fontSize: 14,
    color: '#333',
    fontFamily: 'Onest'
  },
  timeBoxPickerContainer: {
    marginTop: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12
  },
  timeBoxPickerLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'Onest'
  },
  timeBoxDoneButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12
  },
  timeBoxDoneButtonText: {
    fontSize: 15,
    color: '#666',
    fontFamily: 'Onest',
    fontWeight: '500'
  },
  timeBoxAddButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8
  },
  timeBoxAddButtonText: {
    fontSize: 15,
    color: '#666',
    fontFamily: 'Onest',
    fontWeight: '500'
  },
});

// Export constants for use in the main component
export const CALENDAR_CONSTANTS = {
  SCREEN_WIDTH,
  TOTAL_HORIZONTAL_PADDING,
  SIDE_PADDING,
  SCREEN_HEIGHT,
  BASE_CELL_HEIGHT,
  CELL_WIDTH,
  needsSixRows,
  getCellHeight,
};
