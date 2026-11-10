import type { UIMessage } from 'ai';
import { Image, StyleSheet, Text, View } from 'react-native';

/** Pinta un mensaje recorriendo sus parts: texto e imágenes. */
export function ChatBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubble, isUser ? styles.user : styles.assistant]}>
      {message.parts.map((part, i) => {
        switch (part.type) {
          case 'text':
            return (
              <Text key={i} style={isUser ? styles.userText : styles.text} selectable>
                {part.text}
              </Text>
            );
          case 'file':
            return part.mediaType.startsWith('image') ? (
              <Image key={i} source={{ uri: part.url }} style={styles.photo} />
            ) : null;
          default:
            return null; // razonamiento, step-start, herramientas: no se muestran
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderRadius: 14, padding: 12, marginVertical: 4, gap: 8 },
  user: { alignSelf: 'flex-end', backgroundColor: '#10b981' },
  assistant: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  text: { fontSize: 15, color: '#171717', lineHeight: 21 },
  userText: { fontSize: 15, color: '#fff', lineHeight: 21 },
  photo: { width: 200, height: 200, borderRadius: 10 },
});
