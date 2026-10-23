/** Browser stub for expo-image-picker: the pickers always resolve as canceled. */
export type ImagePickerAsset = {
  uri: string;
  width: number;
  height: number;
  type?: 'image' | 'video';
  mimeType?: string;
  fileName?: string | null;
  fileSize?: number;
  duration?: number | null;
};
export type ImagePickerSuccessResult = { canceled: false; assets: ImagePickerAsset[] };
export type ImagePickerCanceledResult = { canceled: true; assets: null };
export type ImagePickerResult = ImagePickerSuccessResult | ImagePickerCanceledResult;
export type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
  expires: 'never';
};

const granted: PermissionResponse = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };
const canceled: ImagePickerCanceledResult = { canceled: true, assets: null };

export const MediaTypeOptions = { All: 'All', Videos: 'Videos', Images: 'Images' } as const;
export const UIImagePickerPreferredAssetRepresentationMode = {
  Automatic: 0,
  Compatible: 1,
  Current: 2,
} as const;

export const requestMediaLibraryPermissionsAsync = async (): Promise<PermissionResponse> => granted;
export const requestCameraPermissionsAsync = async (): Promise<PermissionResponse> => granted;
export const getMediaLibraryPermissionsAsync = async (): Promise<PermissionResponse> => granted;
export const getCameraPermissionsAsync = async (): Promise<PermissionResponse> => granted;
export const launchImageLibraryAsync = async (): Promise<ImagePickerResult> => canceled;
export const launchCameraAsync = async (): Promise<ImagePickerResult> => canceled;
