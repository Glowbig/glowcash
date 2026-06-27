import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = async () => {
    setError('');
    if (!email || !password || !confirm) {
      setError('Completa todos los campos.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signUp({ email, password });
      setLoading(false);

      if (authError) {
        console.error('Signup error:', authError);
        const msg = authError.message;
        setError(!msg || msg === '{}' ? 'Error de conexión. Intenta de nuevo.' : msg);
        return;
      }

      setSuccess(true);
    } catch (e) {
      setLoading(false);
      console.error('Signup exception:', e);
      setError('Error inesperado. Revisa tu conexión e intenta de nuevo.');
    }
  };

  if (success) {
    return (
      <KeyboardAvoidingView style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>📬</Text>
          <Text style={styles.successTitle}>¡Revisa tu correo!</Text>
          <Text style={styles.successText}>
            Te enviamos un link de confirmación a {email}.{'\n'}
            Confirma tu cuenta y luego inicia sesión.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.buttonText}>Ir al inicio de sesión</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>💸</Text>
          <Text style={styles.title}>Crea tu cuenta</Text>
          <Text style={styles.subtitle}>Gratis · Sin anuncios · Solo tuya</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@correo.com"
            placeholderTextColor="#64748B"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor="#64748B"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Repite tu contraseña"
            placeholderTextColor="#64748B"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Creando cuenta...' : 'Crear cuenta'}</Text>
          </TouchableOpacity>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.linkButton}>
              <Text style={styles.linkText}>¿Ya tienes cuenta? <Text style={styles.linkAccent}>Inicia sesión</Text></Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  inner: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '800', color: '#F8FAFC', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#94A3B8', marginTop: 4 },
  form: { gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#CBD5E1', marginBottom: -4 },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#22D3EE',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  linkButton: { alignItems: 'center', paddingVertical: 12 },
  linkText: { fontSize: 14, color: '#94A3B8' },
  linkAccent: { color: '#22D3EE', fontWeight: '600' },
  errorText: { fontSize: 13, color: '#F87171', textAlign: 'center', paddingVertical: 4 },
  successContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  successIcon: { fontSize: 64 },
  successTitle: { fontSize: 26, fontWeight: '800', color: '#F8FAFC', textAlign: 'center' },
  successText: { fontSize: 15, color: '#94A3B8', textAlign: 'center', lineHeight: 22 },
});
