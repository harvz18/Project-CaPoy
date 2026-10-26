import React from 'react'
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native'
import { Text } from './AppText'
import { FloristCustomizationEditor } from './FloristCustomizationEditor'
import type { FloristArrangementDraft, FloristArrangementPricingUnit } from '../lib/florist'

type Props = { value: FloristArrangementDraft[]; onChange: (value: FloristArrangementDraft[]) => void; onAddPhoto?: () => Promise<string | string[] | null | undefined> | string | string[] | null | undefined }
const categories = ['Bridal and Entourage Flowers', 'Wedding Ceremony Flowers', 'Reception Flowers', 'Custom Arrangement']
const units: FloristArrangementPricingUnit[] = ['piece', 'pair', 'set', 'table', 'installation', 'fixed']
const blank = (): FloristArrangementDraft => ({ basePrice: 0, category: categories[0], customizationGroups: [], description: '', imageUrls: [], isActive: true, minimumQuantity: 1, name: '', pricingUnit: 'piece' })

export const FloristArrangementsEditor: React.FC<Props> = ({ value, onChange, onAddPhoto }) => {
  const update = (index: number, patch: Partial<FloristArrangementDraft>) => onChange(value.map((item, current) => current === index ? { ...item, ...patch } : item))
  const addPhoto = async (index: number) => {
    const result = await onAddPhoto?.()
    const photos = (Array.isArray(result) ? result : [result]).filter((item): item is string => typeof item === 'string' && item.length > 0)
    if (photos.length) update(index, { imageUrls: Array.from(new Set([...value[index].imageUrls, ...photos])) })
  }
  return <View style={styles.section}>
    <Text style={styles.title}>Floral Arrangements</Text>
    <Text style={styles.copy}>Add only the arrangements you really offer. These are the chargeable floral offerings clients will see after approval.</Text>
    {value.map((item, index) => <View key={item.id ?? `new-${index}`} style={styles.card}>
      <View style={styles.row}><Text style={styles.cardTitle}>Arrangement {index + 1}</Text><Pressable onPress={() => onChange(value.filter((_, current) => current !== index))}><Text style={styles.remove}>Remove</Text></Pressable></View>
      <TextInput accessibilityLabel={`Arrangement ${index + 1} name`} onChangeText={(name) => update(index, { name })} placeholder="Arrangement name" style={styles.input} value={item.name} />
      <TextInput accessibilityLabel={`Arrangement ${index + 1} description`} multiline onChangeText={(description) => update(index, { description })} placeholder="Description" style={[styles.input, styles.textarea]} value={item.description} />
      <Text style={styles.label}>Classification</Text><View style={styles.chips}>{categories.map((category) => <Pressable key={category} onPress={() => update(index, { category })} style={[styles.chip, item.category === category && styles.chipActive]}><Text style={item.category === category ? styles.chipTextActive : styles.chipText}>{category}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel={`Arrangement ${index + 1} category`} onChangeText={(category) => update(index, { category })} placeholder="Or enter a custom classification" style={styles.input} value={item.category} />
      <View style={styles.row}><TextInput accessibilityLabel={`Arrangement ${index + 1} base price`} keyboardType="decimal-pad" onChangeText={(basePrice) => update(index, { basePrice: Math.max(0, Number(basePrice) || 0) })} placeholder="Base price" style={[styles.input, styles.third]} value={item.basePrice ? String(item.basePrice) : ''} /><TextInput accessibilityLabel={`Arrangement ${index + 1} minimum quantity`} keyboardType="number-pad" onChangeText={(minimumQuantity) => update(index, { minimumQuantity: Math.max(1, Math.floor(Number(minimumQuantity) || 1)) })} placeholder="Minimum qty" style={[styles.input, styles.third]} value={String(item.minimumQuantity)} /><TextInput accessibilityLabel={`Arrangement ${index + 1} maximum quantity`} keyboardType="number-pad" onChangeText={(maximumQuantity) => update(index, { maximumQuantity: maximumQuantity.trim() ? Math.max(item.minimumQuantity, Math.floor(Number(maximumQuantity) || item.minimumQuantity)) : undefined })} placeholder="Maximum qty" style={[styles.input, styles.third]} value={item.maximumQuantity ? String(item.maximumQuantity) : ''} /></View>
      <Text style={styles.label}>Pricing unit</Text><View style={styles.chips}>{units.map((unit) => <Pressable key={unit} onPress={() => update(index, { pricingUnit: unit })} style={[styles.chip, item.pricingUnit === unit && styles.chipActive]}><Text style={item.pricingUnit === unit ? styles.chipTextActive : styles.chipText}>{unit}</Text></Pressable>)}</View>
      <View style={styles.row}><Pressable onPress={() => update(index, { isActive: !item.isActive })} style={styles.toggle}><Text style={styles.toggleText}>{item.isActive ? 'Active offering' : 'Inactive offering'}</Text></Pressable>{onAddPhoto ? <Pressable onPress={() => void addPhoto(index)} style={styles.photoButton}><Text style={styles.photoText}>Add photos</Text></Pressable> : null}</View>
      {item.imageUrls.length ? <View style={styles.photos}>{item.imageUrls.map((uri) => <Image key={uri} source={{ uri }} style={styles.photo} />)}</View> : null}
      <FloristCustomizationEditor onChange={(customizationGroups) => update(index, { customizationGroups })} value={item.customizationGroups} />
    </View>)}
    <Pressable accessibilityRole="button" onPress={() => onChange([...value, blank()])} style={styles.add}><Text style={styles.addText}>+ Add arrangement</Text></Pressable>
  </View>
}
const styles = StyleSheet.create({ section:{gap:12,borderTopWidth:1,borderColor:'#E6E1E2',paddingTop:20},title:{fontSize:18,fontWeight:'700',color:'#211F20'},copy:{fontSize:13,lineHeight:19,color:'#666263'},card:{gap:10,borderWidth:1,borderColor:'#E6E1E2',borderRadius:12,padding:12},row:{flexDirection:'row',gap:8,alignItems:'center',justifyContent:'space-between'},cardTitle:{fontWeight:'700',color:'#211F20'},remove:{color:'#BA1A1A',fontWeight:'700'},label:{fontSize:13,fontWeight:'600',color:'#211F20'},input:{borderWidth:1,borderColor:'#C9C5C6',borderRadius:8,padding:10,color:'#211F20',flex:1},textarea:{minHeight:64,textAlignVertical:'top'},third:{width:'31%'},chips:{flexDirection:'row',flexWrap:'wrap',gap:6},chip:{borderWidth:1,borderColor:'#C9C5C6',borderRadius:99,paddingHorizontal:9,paddingVertical:6},chipActive:{backgroundColor:'#6B1E2E',borderColor:'#6B1E2E'},chipText:{fontSize:12,color:'#4A4647'},chipTextActive:{fontSize:12,color:'#FFF'},toggle:{padding:8,borderRadius:8,backgroundColor:'#F8ECEF'},toggleText:{color:'#6B1E2E',fontWeight:'700',fontSize:12},photoButton:{padding:8,borderRadius:8,backgroundColor:'#6B1E2E'},photoText:{color:'#FFF',fontWeight:'700',fontSize:12},photos:{flexDirection:'row',gap:6},photo:{width:48,height:48,borderRadius:6},add:{alignItems:'center',borderRadius:8,padding:12,backgroundColor:'#F8ECEF'},addText:{color:'#6B1E2E',fontWeight:'700'} })
