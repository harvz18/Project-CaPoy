import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Text } from '../components/AppText'
import {
  createSupportTicket,
  fetchMySupportContext,
  fetchMySupportTickets,
  fetchSupportMessages,
  sendSupportReply,
  SupportContext,
  SupportMessage,
  SupportTicket,
} from '../lib/support'
import { colors } from '../theme/tokens'

const categories = [
  ['account', 'Account'],
  ['booking', 'Booking'],
  ['payment', 'Payment'],
  ['system', 'System'],
  ['technical', 'Technical'],
  ['other', 'Other platform concern'],
] as const

export const SupportScreen = ({ onBack }: { onBack: () => void }) => {
  const [tickets, setTickets] = React.useState<SupportTicket[]>([])
  const [contexts, setContexts] = React.useState<SupportContext[]>([])
  const [context, setContext] = React.useState<SupportContext>()
  const [category, setCategory] = React.useState('booking')
  const [subject, setSubject] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [sending, setSending] = React.useState(false)
  const [selected, setSelected] = React.useState<SupportTicket>()
  const [messages, setMessages] = React.useState<SupportMessage[]>([])
  const [reply, setReply] = React.useState('')

  const load = React.useCallback(async () => {
    const [ticketResult, contextResult] = await Promise.all([
      fetchMySupportTickets(),
      fetchMySupportContext(),
    ])
    setTickets(ticketResult.data)
    setContexts(contextResult.data)
    setMessage(ticketResult.message || contextResult.message || '')
    setLoading(false)
  }, [])

  React.useEffect(() => { void load() }, [load])

  async function submit() {
    if (subject.trim().length < 3 || description.trim().length < 10 || sending) return
    setSending(true)
    setMessage('')
    const result = await createSupportTicket({ category, context, subject, description })
    setSending(false)
    if (!result.ok) {
      setMessage(result.message || 'Unable to create ticket.')
      return
    }
    setSubject('')
    setDescription('')
    setContext(undefined)
    setMessage('Your concern was sent to MULTIVENT Customer Service.')
    await load()
  }

  async function openTicket(ticket: SupportTicket) {
    setSelected(ticket)
    const result = await fetchSupportMessages(ticket.id)
    setMessages(result.data)
    if (result.message) setMessage(result.message)
  }

  async function replyToTicket() {
    if (!selected || !reply.trim() || sending) return
    setSending(true)
    const result = await sendSupportReply(selected.id, reply)
    setSending(false)
    if (!result.ok) setMessage(result.message || 'Unable to reply.')
    else {
      setReply('')
      await load()
      await openTicket(selected)
    }
  }

  const cannotSubmit = sending || subject.trim().length < 3 || description.trim().length < 10

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
          <MaterialCommunityIcons name="arrow-left" color={colors.primaryDark} size={22}/>
        </Pressable>
        <View><Text style={styles.brand}>MULTIVENT</Text><Text style={styles.title}>Customer Support</Text></View>
        <View style={styles.spacer}/>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>How can we help?</Text>
        <Text style={styles.copy}>Report account, booking, payment, or platform concerns. Service-quality feedback remains part of event reviews.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Concern category</Text>
          <View style={styles.categories}>{categories.map(([value, label]) => (
            <Pressable key={value} onPress={() => setCategory(value)} style={[styles.category, category === value && styles.categoryActive]}>
              <Text style={[styles.categoryText, category === value && styles.categoryTextActive]}>{label}</Text>
            </Pressable>
          ))}</View>

          <Text style={styles.label}>Related record (optional)</Text>
          <View style={styles.contexts}>
            <Pressable onPress={() => setContext(undefined)} style={[styles.context, !context && styles.contextActive]}>
              <Text style={[styles.contextType, !context && styles.contextTextActive]}>GENERAL</Text>
              <Text numberOfLines={2} style={[styles.contextLabel, !context && styles.contextTextActive]}>No specific event or booking</Text>
            </Pressable>
            {contexts.map((item) => (
              <Pressable key={`${item.type}:${item.id}`} onPress={() => setContext(item)} style={[styles.context, context?.id === item.id && context?.type === item.type && styles.contextActive]}>
                <Text style={[styles.contextType, context?.id === item.id && context?.type === item.type && styles.contextTextActive]}>{item.type}</Text>
                <Text numberOfLines={2} style={[styles.contextLabel, context?.id === item.id && context?.type === item.type && styles.contextTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Subject</Text>
          <TextInput maxLength={200} style={styles.input} value={subject} onChangeText={setSubject} placeholder="Brief summary" placeholderTextColor={colors.textMuted}/>
          <Text style={styles.label}>Description</Text>
          <TextInput maxLength={4000} multiline style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription} placeholder="Tell us what happened and what you expected." placeholderTextColor={colors.textMuted}/>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Pressable disabled={cannotSubmit} onPress={() => void submit()} style={[styles.submit, cannotSubmit && styles.disabled]}>
            {sending ? <ActivityIndicator color="white"/> : <Text style={styles.submitText}>Submit ticket</Text>}
          </Pressable>
        </View>

        <Text style={styles.section}>Your tickets</Text>
        {loading ? <ActivityIndicator color={colors.primary}/> : tickets.length === 0 ? <Text style={styles.empty}>No support tickets yet.</Text> : tickets.map((ticket) => (
          <Pressable key={ticket.id} onPress={() => void openTicket(ticket)} style={styles.ticket}>
            <View style={styles.ticketMain}>
              <Text style={styles.ticketId}>MV-{String(ticket.ticketNumber).padStart(6, '0')} · {ticket.category.toUpperCase()}</Text>
              <Text style={styles.ticketTitle}>{ticket.subject}</Text>
              <Text style={styles.ticketDate}>{new Date(ticket.createdAt).toLocaleDateString('en-PH')}</Text>
            </View>
            <Text style={styles.status}>{ticket.status.replaceAll('_', ' ')}</Text>
          </Pressable>
        ))}

        {selected ? <View style={styles.thread}>
          <View style={styles.threadHeader}><View style={styles.ticketMain}><Text style={styles.ticketId}>MV-{String(selected.ticketNumber).padStart(6, '0')}</Text><Text style={styles.ticketTitle}>{selected.subject}</Text></View><Pressable onPress={() => setSelected(undefined)}><MaterialCommunityIcons name="close" color={colors.primaryDark} size={20}/></Pressable></View>
          <Text style={styles.threadStatus}>{selected.status.replaceAll('_', ' ')} · {selected.priority} priority</Text>
          {messages.length === 0 ? <Text style={styles.empty}>No replies yet.</Text> : messages.map((item) => <View key={item.id} style={[styles.bubble, item.mine && styles.bubbleMine]}><Text style={styles.bubbleAuthor}>{item.mine ? 'You' : 'MULTIVENT Support'}</Text><Text style={styles.bubbleText}>{item.body}</Text></View>)}
          {selected.status !== 'closed' ? <><TextInput maxLength={4000} multiline style={[styles.input, styles.reply]} value={reply} onChangeText={setReply} placeholder="Reply to support" placeholderTextColor={colors.textMuted}/><Pressable disabled={sending || !reply.trim()} onPress={() => void replyToTicket()} style={[styles.submit, (sending || !reply.trim()) && styles.disabled]}><Text style={styles.submitText}>Send reply</Text></Pressable></> : <Text style={styles.empty}>This ticket is closed. Create a new ticket if you need more help.</Text>}
        </View> : null}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  back:{alignItems:'center',borderColor:colors.border,borderRadius:10,borderWidth:1,height:40,justifyContent:'center',width:40},
  brand:{color:colors.primary,fontFamily:'Inter_700Bold',fontSize:10,letterSpacing:1.4,textAlign:'center'},
  bubble:{alignSelf:'flex-start',backgroundColor:colors.background,borderRadius:10,maxWidth:'88%',padding:10},
  bubbleAuthor:{color:colors.primary,fontFamily:'Inter_700Bold',fontSize:9},
  bubbleMine:{alignSelf:'flex-end',backgroundColor:'#F4E8EB'},
  bubbleText:{color:colors.textPrimary,fontFamily:'Inter_400Regular',fontSize:12,lineHeight:18,marginTop:4},
  card:{backgroundColor:colors.surfaceElevated,borderColor:colors.border,borderRadius:16,borderWidth:1,padding:18},
  categories:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:16},
  category:{borderColor:colors.border,borderRadius:20,borderWidth:1,paddingHorizontal:11,paddingVertical:7},
  categoryActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  categoryText:{color:colors.textSecondary,fontFamily:'Inter_500Medium',fontSize:11},
  categoryTextActive:{color:'white'},
  content:{padding:18,paddingBottom:50},
  context:{backgroundColor:colors.background,borderColor:colors.border,borderRadius:10,borderWidth:1,minHeight:62,padding:10,width:'48%'},
  contextActive:{backgroundColor:colors.primary,borderColor:colors.primary},
  contextLabel:{color:colors.textPrimary,fontFamily:'Inter_500Medium',fontSize:11,lineHeight:15,marginTop:3},
  contexts:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:16},
  contextTextActive:{color:'white'},
  contextType:{color:colors.primary,fontFamily:'Inter_700Bold',fontSize:8,letterSpacing:.5,textTransform:'uppercase'},
  copy:{color:colors.textSecondary,fontFamily:'Inter_400Regular',fontSize:13,lineHeight:20,marginBottom:20},
  disabled:{opacity:.5},
  empty:{color:colors.textMuted,fontFamily:'Inter_400Regular',fontSize:13,textAlign:'center'},
  header:{alignItems:'center',backgroundColor:colors.surfaceElevated,borderBottomColor:colors.border,borderBottomWidth:1,flexDirection:'row',justifyContent:'space-between',padding:14},
  heading:{color:colors.textPrimary,fontFamily:'Inter_700Bold',fontSize:24,marginBottom:7},
  input:{backgroundColor:colors.background,borderColor:colors.border,borderRadius:10,borderWidth:1,color:colors.textPrimary,fontFamily:'Inter_400Regular',fontSize:14,marginBottom:15,minHeight:46,paddingHorizontal:12,paddingVertical:10},
  label:{color:colors.textPrimary,fontFamily:'Inter_600SemiBold',fontSize:12,marginBottom:7},
  message:{color:colors.primaryDark,fontFamily:'Inter_500Medium',fontSize:12,marginBottom:12},
  reply:{marginTop:12,minHeight:75,textAlignVertical:'top'},
  screen:{backgroundColor:colors.backgroundSecondary,flex:1},
  section:{color:colors.textPrimary,fontFamily:'Inter_700Bold',fontSize:18,marginBottom:12,marginTop:26},
  spacer:{width:40},
  status:{backgroundColor:'#F4E8EB',borderRadius:20,color:colors.primaryDark,fontFamily:'Inter_600SemiBold',fontSize:10,overflow:'hidden',paddingHorizontal:10,paddingVertical:6,textTransform:'capitalize'},
  submit:{alignItems:'center',backgroundColor:colors.primary,borderRadius:11,justifyContent:'center',minHeight:49},
  submitText:{color:'white',fontFamily:'Inter_700Bold',fontSize:14},
  textarea:{minHeight:115,textAlignVertical:'top'},
  thread:{backgroundColor:colors.surfaceElevated,borderColor:colors.border,borderRadius:15,borderWidth:1,gap:8,marginTop:16,padding:14},
  threadHeader:{alignItems:'center',flexDirection:'row',justifyContent:'space-between',marginBottom:4},
  threadStatus:{color:colors.textSecondary,fontFamily:'Inter_500Medium',fontSize:10,textTransform:'capitalize'},
  ticket:{alignItems:'center',backgroundColor:colors.surfaceElevated,borderColor:colors.border,borderRadius:13,borderWidth:1,flexDirection:'row',gap:10,justifyContent:'space-between',marginBottom:9,padding:14},
  ticketDate:{color:colors.textMuted,fontFamily:'Inter_400Regular',fontSize:10,marginTop:4},
  ticketId:{color:colors.primary,fontFamily:'Inter_700Bold',fontSize:9,letterSpacing:.5},
  ticketMain:{flex:1,minWidth:0},
  ticketTitle:{color:colors.textPrimary,fontFamily:'Inter_600SemiBold',fontSize:13,marginTop:5},
  title:{color:colors.textPrimary,fontFamily:'Inter_600SemiBold',fontSize:15,textAlign:'center'},
})
