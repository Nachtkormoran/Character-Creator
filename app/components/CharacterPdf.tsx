import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { TRAIT_LABELS, type CharacterTraits } from "@/lib/schema";

export interface CharacterPdfData {
  name: string;
  kurzbeschreibung: string;
  beschreibung: string;
  merkmale: CharacterTraits;
  imageData: string | null;
  scenarioName: string | null;
  createdAt?: string;
}

const colors = {
  text: "#1a1a1e",
  muted: "#6b7280",
  line: "#e5e7eb",
  rowAlt: "#f5f5f6",
  accent: "#4f46e5",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingHorizontal: 44,
    paddingBottom: 56,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: colors.text,
    lineHeight: 1.45,
  },
  header: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  headerText: { flex: 1 },
  name: {
    fontSize: 21,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.15,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10.5,
    fontFamily: "Helvetica-Oblique",
    color: colors.muted,
    lineHeight: 1.3,
  },
  meta: { fontSize: 8.5, color: colors.muted, marginTop: 8 },
  portrait: {
    width: 118,
    height: 118,
    borderRadius: 6,
    objectFit: "cover",
    border: `1 solid ${colors.line}`,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginVertical: 14,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: colors.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 7,
  },
  traitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  traitRowAlt: { backgroundColor: colors.rowAlt },
  traitLabel: {
    width: "35%",
    color: colors.muted,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    lineHeight: 1,
  },
  traitValue: { width: "65%", fontSize: 9, lineHeight: 1 },
  paragraph: { fontSize: 9.5, marginBottom: 6, textAlign: "justify" },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: colors.muted,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 6,
  },
});

function CharacterPdfDocument({ data }: { data: CharacterPdfData }) {
  const traitKeys = Object.keys(TRAIT_LABELS) as (keyof CharacterTraits)[];
  const paragraphs = data.beschreibung
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Document title={data.name || "Charakter"}>
      <Page size="A4" style={styles.page}>
        {/* Kopf */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.name}>{data.name || "Unbenannt"}</Text>
            {data.kurzbeschreibung ? (
              <Text style={styles.subtitle}>{data.kurzbeschreibung}</Text>
            ) : null}
            <Text style={styles.meta}>
              {[
                data.scenarioName ? `Szenario: ${data.scenarioName}` : null,
                data.createdAt
                  ? `Erstellt: ${new Date(data.createdAt).toLocaleDateString("de-DE")}`
                  : null,
              ]
                .filter(Boolean)
                .join("   •   ")}
            </Text>
          </View>
          {data.imageData ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image style={styles.portrait} src={data.imageData} />
          ) : null}
        </View>

        <View style={styles.divider} />

        {/* Merkmale */}
        <Text style={styles.sectionTitle}>Merkmale</Text>
        <View>
          {traitKeys.map((key, i) => (
            <View
              key={key}
              style={
                i % 2 === 0
                  ? [styles.traitRow, styles.traitRowAlt]
                  : styles.traitRow
              }
            >
              <Text style={styles.traitLabel}>{TRAIT_LABELS[key]}</Text>
              <Text style={styles.traitValue}>{String(data.merkmale[key])}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        {/* Beschreibung */}
        <Text style={styles.sectionTitle}>Beschreibung</Text>
        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.paragraph}>
            {p}
          </Text>
        ))}

        <View style={styles.footer} fixed>
          <Text>{data.name || "Charakter"}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

/** Erzeugt das PDF als Blob (clientseitig). */
export function renderCharacterPdfBlob(data: CharacterPdfData): Promise<Blob> {
  return pdf(<CharacterPdfDocument data={data} />).toBlob();
}
