import * as FileSystem from "expo-file-system/legacy"
import * as Sharing from "expo-sharing"

export async function shareCsvFile(input: {
  fileName: string
  csv: string
}) {
  const cacheDirectory = FileSystem.cacheDirectory

  if (!cacheDirectory) {
    throw new Error("File sharing is unavailable on this device.")
  }

  const isSharingAvailable = await Sharing.isAvailableAsync()

  if (!isSharingAvailable) {
    throw new Error("File sharing is unavailable on this device.")
  }

  const fileUri = `${cacheDirectory}${input.fileName}`

  await FileSystem.writeAsStringAsync(fileUri, input.csv, {
    encoding: FileSystem.EncodingType.UTF8
  })
  await Sharing.shareAsync(fileUri, {
    mimeType: "text/csv",
    dialogTitle: "Export lead data",
    UTI: "public.comma-separated-values-text"
  })
}
