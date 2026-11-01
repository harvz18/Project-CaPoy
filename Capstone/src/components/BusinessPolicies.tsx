import { MaterialCommunityIcons } from '@expo/vector-icons'
import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native'
import {
  BusinessPolicy,
  loadMyBusinessPolicies,
  loadPublishedBusinessPolicies,
  policyPresetTemplates,
  removeMyBusinessPolicy,
  saveMyBusinessPolicy,
} from '../lib/business-policies'
import { colors } from '../theme/tokens'
import { Text } from './AppText'

type EditorProps = { audience: 'provider' | 'coordinator' }
type ViewerProps = { ownerId?: string }

const categoryLabel = (value: BusinessPolicy['category']) => value.replace(/_/g, ' ')

const newId = () => `new:${Date.now()}:${Math.random().toString(36).slice(2)}`

export const BusinessPoliciesEditor: React.FC<EditorProps> = ({ audience }) => {
  const [policies, setPolicies] = React.useState<BusinessPolicy[]>([])
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [workingId, setWorkingId] = React.useState('')

  React.useEffect(() => {
    let active = true
    void loadMyBusinessPolicies().then((result) => {
      if (!active) return
      if (result.ok) setPolicies(result.data ?? [])
      else setError(result.message ?? 'Unable to load business policies.')
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const update = (id: string, patch: Partial<BusinessPolicy>) => {
    setPolicies((current) => current.map((policy) => policy.id === id ? { ...policy, ...patch } : policy))
  }

  const addPreset = (preset?: Pick<BusinessPolicy, 'category' | 'text' | 'title'>) => {
    setPolicies((current) => [...current, {
      category: preset?.category ?? 'service_conditions',
      id: newId(),
      status: 'draft',
      text: preset?.text ?? '',
      title: preset?.title ?? '',
      version: 1,
    }])
  }

  const save = async (policy: BusinessPolicy, status = policy.status) => {
    setWorkingId(policy.id)
    setError('')
    const result = await saveMyBusinessPolicy({ ...policy, status })
    setWorkingId('')
    if (!result.ok || !result.data) {
      setError(result.message ?? 'Unable to save this policy.')
      return
    }
    setPolicies((current) => current.map((item) => item.id === policy.id ? result.data as BusinessPolicy : item))
  }

  const remove = async (policy: BusinessPolicy) => {
    setWorkingId(policy.id)
    setError('')
    const result = await removeMyBusinessPolicy(policy.id)
    setWorkingId('')
    if (!result.ok) { setError(result.message ?? 'Unable to remove this policy.'); return }
    setPolicies((current) => current.filter((item) => item.id !== policy.id))
  }

  return (
    <View style={styles.editorSection}>
      <Text style={styles.editorTitle}>Business Policies</Text>
      <Text style={styles.editorCopy}>
        Add the information clients should know before booking your {audience === 'coordinator' ? 'coordination service' : 'business'}. These are informational terms and cannot override MULTIVENT payment, refund, cancellation, acceptance, or payout rules.
      </Text>
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading policies...</Text></View> : null}
      {!loading ? <>
        <Text style={styles.templateTitle}>Start from a template</Text>
        <View style={styles.templateList}>
          {policyPresetTemplates.map((preset) => (
            <Pressable accessibilityRole="button" key={preset.category} onPress={() => addPreset(preset)} style={styles.templateButton}>
              <MaterialCommunityIcons color={colors.primary} name="plus-circle-outline" size={18} />
              <Text style={styles.templateText}>{preset.title}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={() => addPreset()} style={styles.templateButton}>
            <MaterialCommunityIcons color={colors.primary} name="pencil-plus-outline" size={18} />
            <Text style={styles.templateText}>Custom policy</Text>
          </Pressable>
        </View>

        {policies.map((policy) => {
          const working = workingId === policy.id
          return <View key={policy.id} style={styles.policyCard}>
            <View style={styles.policyCardHeader}>
              <Text style={styles.policyCategory}>{categoryLabel(policy.category)}</Text>
              <Text style={[styles.status, policy.status === 'published' ? styles.statusPublished : styles.statusDraft]}>{policy.status}</Text>
            </View>
            <Text style={styles.fieldLabel}>Policy title</Text>
            <TextInput accessibilityLabel="Policy title" onChangeText={(title) => update(policy.id, { title })} placeholder="e.g. Booking requirements" placeholderTextColor={colors.textMuted} style={styles.input} value={policy.title} />
            <Text style={styles.fieldLabel}>Policy details</Text>
            <TextInput accessibilityLabel="Policy details" multiline onChangeText={(text) => update(policy.id, { text })} placeholder="Describe this policy in clear, client-friendly terms." placeholderTextColor={colors.textMuted} style={[styles.input, styles.textarea]} value={policy.text} />
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" disabled={working} onPress={() => void save(policy, 'draft')} style={[styles.secondaryAction, working && styles.disabled]}>
                <Text style={styles.secondaryActionText}>Save draft</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={working} onPress={() => void save(policy, 'published')} style={[styles.primaryAction, working && styles.disabled]}>
                {working ? <ActivityIndicator color={colors.textInverse} size="small" /> : <Text style={styles.primaryActionText}>{policy.status === 'published' ? 'Update published' : 'Publish'}</Text>}
              </Pressable>
            </View>
            <Pressable accessibilityLabel={`Remove ${policy.title || 'policy'}`} accessibilityRole="button" disabled={working} onPress={() => void remove(policy)} style={styles.removeAction}>
              <MaterialCommunityIcons color={colors.error} name="trash-can-outline" size={17} />
              <Text style={styles.removeText}>Remove policy</Text>
            </Pressable>
          </View>
        })}
        {!policies.length ? <Text style={styles.empty}>No policies added yet. Choose a template or add a custom policy.</Text> : null}
      </> : null}
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Text style={styles.footerNote}>Published policies are shown to clients before they submit a booking request. Existing booking snapshots are retained when policies later change.</Text>
    </View>
  )
}

export const PublishedBusinessPolicies: React.FC<ViewerProps> = ({ ownerId }) => {
  const [expanded, setExpanded] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [policies, setPolicies] = React.useState<BusinessPolicy[]>([])

  const open = () => {
    const nextExpanded = !expanded
    setExpanded(nextExpanded)
    if (!nextExpanded || policies.length || loading || !ownerId) return
    setLoading(true)
    void loadPublishedBusinessPolicies(ownerId).then((result) => {
      if (result.ok) setPolicies(result.data ?? [])
      setLoading(false)
    })
  }

  if (!ownerId) return null
  return <View style={styles.viewer}>
    <Pressable accessibilityLabel="View business policies" accessibilityRole="button" accessibilityState={{ expanded }} onPress={open} style={styles.viewerButton}>
      <View style={styles.viewerTitleRow}><MaterialCommunityIcons color={colors.primary} name="file-document-outline" size={21} /><Text style={styles.viewerTitle}>View Policies</Text></View>
      <MaterialCommunityIcons color={colors.primary} name={expanded ? 'chevron-up' : 'chevron-down'} size={22} />
    </Pressable>
    {expanded ? <View style={styles.viewerContent}>
      <Text style={styles.viewerNote}>These policies are informational. MULTIVENT&apos;s payment, cancellation, refund, and booking rules continue to apply.</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : policies.length ? policies.map((policy) => <View key={policy.id} style={styles.publishedPolicy}><Text style={styles.publishedTitle}>{policy.title}</Text><Text style={styles.publishedText}>{policy.text}</Text></View>) : <Text style={styles.empty}>This {ownerId ? 'business' : 'provider'} has not published any policies yet.</Text>}
    </View> : null}
  </View>
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  disabled: { opacity: 0.55 },
  editorCopy: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  editorSection: { borderTopColor: colors.divider, borderTopWidth: 1, gap: 10, marginTop: 24, paddingTop: 22 },
  editorTitle: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 16 },
  empty: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, paddingVertical: 6 },
  error: { color: colors.error, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 17 },
  fieldLabel: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 12, marginTop: 4 },
  footerNote: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 4 },
  input: { borderColor: colors.divider, borderRadius: 10, borderWidth: 1, color: colors.textPrimary, fontFamily: 'Inter_400Regular', fontSize: 14, minHeight: 46, paddingHorizontal: 12, paddingVertical: 10 },
  loading: { alignItems: 'center', flexDirection: 'row', gap: 8, paddingVertical: 8 },
  loadingText: { color: colors.textMuted, fontFamily: 'Inter_500Medium', fontSize: 13 },
  policyCard: { backgroundColor: colors.backgroundSecondary, borderColor: colors.divider, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 4, padding: 12 },
  policyCardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  policyCategory: { color: colors.textMuted, fontFamily: 'Inter_700Bold', fontSize: 11, textTransform: 'uppercase' },
  primaryAction: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: 9, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 10 },
  primaryActionText: { color: colors.textInverse, fontFamily: 'Inter_700Bold', fontSize: 13 },
  publishedPolicy: { borderTopColor: colors.divider, borderTopWidth: 1, gap: 4, paddingTop: 12 },
  publishedText: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  publishedTitle: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 14 },
  removeAction: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 5, marginTop: 2, minHeight: 30 },
  removeText: { color: colors.error, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  secondaryAction: { alignItems: 'center', borderColor: colors.primary, borderRadius: 9, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 42, paddingHorizontal: 10 },
  secondaryActionText: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 13 },
  status: { borderRadius: 999, fontFamily: 'Inter_700Bold', fontSize: 10, overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4, textTransform: 'uppercase' },
  statusDraft: { backgroundColor: '#EFE7D6', color: '#735C24' },
  statusPublished: { backgroundColor: '#E2F1E7', color: '#21633C' },
  templateButton: { alignItems: 'center', borderColor: colors.divider, borderRadius: 9, borderWidth: 1, flexDirection: 'row', gap: 7, minHeight: 40, paddingHorizontal: 10 },
  templateList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  templateText: { color: colors.primaryDark, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  templateTitle: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 13, marginTop: 4 },
  textarea: { minHeight: 94, textAlignVertical: 'top' },
  viewer: { backgroundColor: colors.backgroundSecondary, borderColor: colors.divider, borderRadius: 14, borderWidth: 1, marginTop: 18, overflow: 'hidden' },
  viewerButton: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 54, paddingHorizontal: 14 },
  viewerContent: { borderTopColor: colors.divider, borderTopWidth: 1, gap: 12, padding: 14 },
  viewerNote: { color: colors.textMuted, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17 },
  viewerTitle: { color: colors.primaryDark, fontFamily: 'Inter_700Bold', fontSize: 15 },
  viewerTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
})
