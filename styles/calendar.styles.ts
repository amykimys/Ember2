import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  viewSelector: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  viewButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  activeViewButton: {
    backgroundColor: '#007AFF',
  },
  viewButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
  activeViewButtonText: {
    color: '#fff',
  },
  addButton: {
    position: 'absolute',
    right: 240,
    bottom: 80,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#A0C3B2',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalBody: {
    maxHeight: '80%',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  descriptionInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 16,
  },
  timeButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Calendar styles
  calendarHeader: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    padding: 8,
  },
  calendarHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  eventCell: {
    backgroundColor: '#007AFF',
    borderRadius: 4,
    padding: 4,
  },
  eventText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  todayCell: {
    backgroundColor: '#e6f2ff',
  },
  selectedCell: {
    backgroundColor: '#007AFF',
  },
  agendaItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  agendaItemText: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  // Weekly view styles
  weekContainer: {
    flex: 1,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  weekNavButton: {
    padding: 8,
  },
  weekHeaderText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  weekDayStrip: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    minWidth: 40,
  },
  selectedWeekDayStrip: {
    backgroundColor: '#007AFF',
  },
  weekDayStripText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  weekDayStripDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  selectedWeekDayStripText: {
    color: '#fff',
  },
  weekEventsContainer: {
    flex: 1,
    padding: 16,
  },
  weekDayContainer: {
    marginBottom: 16,
  },
  weekDayHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  weekEventItem: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  weekEventTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  weekEventTitle: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  // Google Calendar style weekly view
  weekGrid: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  weekGridHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  timeColumn: {
    width: 60,
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  dayColumn: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  dayHeader: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 8,
  },
  dateHeader: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    padding: 4,
  },
  weekGridBody: {
    flex: 1,
  },
  hourRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 60,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    padding: 4,
  },
});
