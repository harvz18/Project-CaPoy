import React from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { Text } from './AppText'
import type { InboxTrashItem } from '../lib/inbox-trash'

interface InboxTrashModalProps {
  busy?: boolean
  items?: InboxTrashItem[]
  onClear?: (items: InboxTrashItem[]) => void
  onClose?: () => void
  onRestore?: (items: InboxTrashItem[]) => void
  visible: boolean
}

const labelFor = (itemType: InboxTrashItem['itemType']) =>
  itemType === 'conversation' ? 'Conversation' : itemType === 'message' ? 'Message' : 'Notification'

const formatTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-PH', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export const InboxTrashModal: React.FC<InboxTrashModalProps> = ({
  busy = false,
  items = [],
  onClear,
  onClose,
  onRestore,
  visible,
}) => {
  const [selectedIds, setSelectedIds] = React.useState<ReadonlySet<string>>(() => new Set())

  React.useEffect(() => {
    if (!visible) setSelectedIds(new Set())
  }, [visible])

  React.useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => items.some((item) => item.id === id))))
  }, [items])

  const selectedItems = items.filter((item) => selectedIds.has(item.id))
  const allSelected = items.length > 0 && selectedItems.length === items.length
  const someSelected = selectedItems.length > 0 && !allSelected
  const toggle = (id: string) => setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleAll = () => setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item.id)))

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable accessibilityLabel="Close Trash" accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>‹</Text>
            </Pressable>
            <Text style={styles.title}>Inbox Trash</Text>
            <Pressable
              accessibilityLabel={allSelected ? 'Deselect all trashed items' : someSelected ? 'Select all remaining trashed items' : 'Select all trashed items'}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allSelected ? true : someSelected ? 'mixed' : false, disabled: busy }}
              disabled={busy || !items.length}
              onPress={toggleAll}
              style={[styles.headerButton, (!items.length || busy) && styles.disabled]}
            >
              <Text style={styles.checkbox}>{allSelected ? '☑' : someSelected ? '▣' : '☐'}</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>
            {selectedItems.length ? `${selectedItems.length} selected` : 'Items here are hidden only from your Inbox.'}
          </Text>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {items.length ? items.map((item) => {
              const selected = selectedIds.has(item.id)
              return (
                <Pressable
                  key={`${item.itemType}:${item.id}`}
                  accessibilityLabel={`${selected ? 'Deselect' : 'Select'} ${labelFor(item.itemType)}: ${item.title}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected, disabled: busy }}
                  disabled={busy}
                  onLongPress={() => toggle(item.id)}
                  onPress={() => toggle(item.id)}
                  style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
                >
                  <Text style={styles.rowCheckbox}>{selected ? '☑' : '☐'}</Text>
                  <View style={styles.copy}>
                    <View style={styles.rowTitleLine}>
                      <Text numberOfLines={1} style={styles.rowTitle}>{item.title}</Text>
                      <Text style={styles.type}>{labelFor(item.itemType)}</Text>
                    </View>
                    <Text numberOfLines={2} style={styles.preview}>{item.preview}</Text>
                    <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
                  </View>
                </Pressable>
              )
            }) : (
              <View style={styles.empty}><Text style={styles.emptyTitle}>Trash is empty</Text><Text style={styles.emptyText}>Items you remove from your Inbox will appear here.</Text></View>
            )}
          </ScrollView>

          {selectedItems.length ? (
            <View style={styles.actions}>
              <Pressable accessibilityLabel="Restore selected Inbox items" accessibilityRole="button" disabled={busy} onPress={() => onRestore?.(selectedItems)} style={[styles.restoreButton, busy && styles.disabled]}>
                <Text style={styles.restoreText}>Restore</Text>
              </Pressable>
              <Pressable accessibilityLabel="Permanently clear selected Inbox items from my view" accessibilityRole="button" disabled={busy} onPress={() => onClear?.(selectedItems)} style={[styles.clearButton, busy && styles.disabled]}>
                <Text style={styles.clearText}>Clear permanently</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24, 13, 16, 0.38)' },
  sheet: { maxHeight: '84%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#FAF9F9', paddingTop: 9 },
  handle: { width: 40, height: 4, alignSelf: 'center', borderRadius: 2, backgroundColor: '#A7A1A2' },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14 },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21 },
  headerButtonText: { color: '#6B1E2E', fontSize: 34, lineHeight: 36, fontWeight: '400' },
  title: { color: '#1B1C1C', fontSize: 18, lineHeight: 24, fontWeight: '800' },
  subtitle: { color: '#5D5F5F', fontSize: 12, lineHeight: 17, paddingHorizontal: 20, paddingBottom: 9 },
  checkbox: { color: '#6B1E2E', fontSize: 22, lineHeight: 25 },
  list: { paddingBottom: 18 },
  row: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#E8E3E4', paddingHorizontal: 18, paddingVertical: 10 },
  rowSelected: { backgroundColor: '#F7ECEE' },
  rowCheckbox: { color: '#6B1E2E', fontSize: 20, lineHeight: 24 },
  copy: { minWidth: 0, flex: 1 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  rowTitle: { minWidth: 0, flex: 1, color: '#1B1C1C', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  type: { color: '#6B1E2E', fontSize: 9, lineHeight: 13, fontWeight: '800', textTransform: 'uppercase' },
  preview: { color: '#5D5F5F', fontSize: 11, lineHeight: 16, marginTop: 2 },
  time: { color: '#777879', fontSize: 9, lineHeight: 13, marginTop: 3 },
  empty: { alignItems: 'center', paddingHorizontal: 30, paddingVertical: 48 },
  emptyTitle: { color: '#1B1C1C', fontSize: 16, lineHeight: 21, fontWeight: '800' },
  emptyText: { color: '#5D5F5F', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  actions: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#E8E3E4', padding: 14 },
  restoreButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#6B1E2E', borderRadius: 12, backgroundColor: '#FFFFFF' },
  restoreText: { color: '#6B1E2E', fontSize: 12, fontWeight: '800' },
  clearButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#6B1E2E' },
  clearText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.66 },
})
