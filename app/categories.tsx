import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../src/stores/auth';
import { supabase } from '../src/lib/supabase';
import { Category, CategoryType } from '../src/types';

const TYPE_OPTIONS: { value: CategoryType; label: string; color: string }[] = [
  { value: 'need', label: 'Fijo', color: '#22D3EE' },
  { value: 'want', label: 'Variable', color: '#A78BFA' },
  { value: 'saving', label: 'Ahorro', color: '#4ADE80' },
];

const ICON_OPTIONS = ['🛒', '🚌', '💡', '🎬', '🍔', '💊', '👕', '🏠', '📚', '💰', '✈️', '🐾', '🎮', '💳', '🔧', '📱'];

const TYPE_LABELS: Record<CategoryType, string> = { need: 'Fijos', want: 'Variables', saving: 'Ahorro' };
const TYPE_COLORS: Record<CategoryType, string> = { need: '#22D3EE', want: '#A78BFA', saving: '#4ADE80' };

export default function CategoriesScreen() {
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CategoryType>('want');
  const [newIcon, setNewIcon] = useState('💳');
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('categories')
      .select('*')
      .or(`user_id.eq.${user.id},is_default.eq.true`)
      .order('is_default', { ascending: false })
      .order('name');
    setCategories((data as Category[]) ?? []);
  };

  useEffect(() => { fetchCategories(); }, [user]);

  const handleAdd = async () => {
    if (!user || !newName.trim()) return;
    setSaving(true);
    await supabase.from('categories').insert({
      user_id: user.id,
      name: newName.trim(),
      type: newType,
      icon: newIcon,
      color: TYPE_COLORS[newType],
      is_default: false,
    });
    setNewName('');
    setNewIcon('💳');
    setNewType('want');
    setShowForm(false);
    setSaving(false);
    fetchCategories();
  };

  const handleDelete = (cat: Category) => {
    if (cat.is_default) return;
    Alert.alert('Eliminar categoría', `¿Eliminar "${cat.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('categories').delete().eq('id', cat.id);
          fetchCategories();
        },
      },
    ]);
  };

  const grouped = TYPE_OPTIONS.reduce<Record<CategoryType, Category[]>>((acc, t) => {
    acc[t.value] = categories.filter((c) => c.type === t.value);
    return acc;
  }, { need: [], want: [], saving: [] });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0F172A' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Categorías</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)}>
          <Text style={styles.addBtn}>{showForm ? 'Cancelar' : '+ Nueva'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Add form */}
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Nueva categoría</Text>

            <TextInput
              style={styles.input}
              placeholder="Nombre (ej: Mascotas)"
              placeholderTextColor="#64748B"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <Text style={styles.formLabel}>Tipo</Text>
            <View style={styles.typeRow}>
              {TYPE_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeChip, newType === t.value && { backgroundColor: t.color + '30', borderColor: t.color }]}
                  onPress={() => { setNewType(t.value); setNewIcon(newIcon); }}
                >
                  <Text style={[styles.typeChipText, newType === t.value && { color: t.color }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.formLabel}>Ícono</Text>
            <View style={styles.iconGrid}>
              {ICON_OPTIONS.map((ic) => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconOption, newIcon === ic && styles.iconOptionActive]}
                  onPress={() => setNewIcon(ic)}
                >
                  <Text style={styles.iconText}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, (!newName.trim() || saving) && styles.saveBtnDisabled]}
              onPress={handleAdd}
              disabled={!newName.trim() || saving}
            >
              <Text style={styles.saveBtnText}>Guardar categoría</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Categories by type */}
        {TYPE_OPTIONS.map(({ value, label, color }) => (
          <View key={value} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={[styles.groupDot, { backgroundColor: color }]} />
              <Text style={[styles.groupLabel, { color }]}>{label}</Text>
              <Text style={styles.groupCount}>{grouped[value].length}</Text>
            </View>
            {grouped[value].length === 0 ? (
              <Text style={styles.emptyText}>Sin categorías</Text>
            ) : (
              grouped[value].map((cat) => (
                <View key={cat.id} style={styles.catRow}>
                  <Text style={styles.catIcon}>{cat.icon}</Text>
                  <Text style={styles.catName}>{cat.name}</Text>
                  {cat.is_default ? (
                    <Text style={styles.defaultBadge}>Por defecto</Text>
                  ) : (
                    <TouchableOpacity onPress={() => handleDelete(cat)}>
                      <Text style={styles.deleteBtn}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  closeBtn: { fontSize: 20, color: '#94A3B8', width: 24 },
  title: { fontSize: 17, fontWeight: '700', color: '#F8FAFC' },
  addBtn: { fontSize: 14, fontWeight: '700', color: '#22D3EE' },
  content: { padding: 20, paddingBottom: 48 },
  formCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#334155', gap: 12 },
  formTitle: { fontSize: 15, fontWeight: '700', color: '#F8FAFC' },
  formLabel: { fontSize: 12, fontWeight: '600', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#0F172A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#F8FAFC', borderWidth: 1, borderColor: '#334155',
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#334155',
    alignItems: 'center', backgroundColor: '#0F172A',
  },
  typeChipText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconOption: { width: 44, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: '#334155', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F172A' },
  iconOptionActive: { borderColor: '#22D3EE', backgroundColor: '#0F2A35' },
  iconText: { fontSize: 22 },
  saveBtn: { backgroundColor: '#22D3EE', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  group: { marginBottom: 20 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupLabel: { fontSize: 13, fontWeight: '700', flex: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  groupCount: { fontSize: 12, color: '#475569' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  catIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  catName: { flex: 1, fontSize: 14, color: '#CBD5E1' },
  defaultBadge: { fontSize: 11, color: '#475569', backgroundColor: '#1E293B', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  deleteBtn: { fontSize: 14, color: '#F87171', paddingHorizontal: 4 },
  emptyText: { fontSize: 12, color: '#475569', paddingVertical: 8 },
});
