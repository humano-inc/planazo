import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { GROUP_PHOTO_BUCKET, groupPhotoPath } from '@planazo/shared';
import { uploadAvatar, uploadGroupPhoto, uploadJpeg } from '../images';
import { supabase } from '../supabase';

jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-file-system/legacy', () => ({ readAsStringAsync: jest.fn() }));
jest.mock('base64-arraybuffer', () => ({ decode: jest.fn() }));
jest.mock('../supabase', () => ({ supabase: { storage: { from: jest.fn() } } }));

const NOW = 1754870400000;
const BYTES = new ArrayBuffer(8);

const mockRead = FileSystem.readAsStringAsync as jest.Mock;
const mockDecode = decode as jest.Mock;
const mockStorageFrom = supabase.storage.from as jest.Mock;

let upload: jest.Mock;
let buckets: string[] = [];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  buckets = [];
  upload = jest.fn().mockResolvedValue({ error: null });
  mockRead.mockResolvedValue('base64data');
  mockDecode.mockReturnValue(BYTES);
  mockStorageFrom.mockImplementation((bucket: string) => {
    buckets.push(bucket);
    return {
      upload,
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn/${bucket}/${path}` } }),
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('uploadJpeg', () => {
  it('sends the decoded file rather than the base64 text', async () => {
    await uploadJpeg({ bucket: 'avatars', path: 'user-1/avatar.jpg', uri: 'file:///photo.jpg' });

    expect(mockRead).toHaveBeenCalledWith('file:///photo.jpg', { encoding: 'base64' });
    expect(mockDecode).toHaveBeenCalledWith('base64data');
    expect(upload).toHaveBeenCalledWith('user-1/avatar.jpg', BYTES, {
      upsert: false,
      contentType: 'image/jpeg',
    });
  });

  it('overwrites only when asked to', async () => {
    await uploadJpeg({
      bucket: 'avatars',
      path: 'user-1/avatar.jpg',
      uri: 'file:///photo.jpg',
      upsert: true,
    });

    expect(upload).toHaveBeenCalledWith(
      'user-1/avatar.jpg',
      BYTES,
      expect.objectContaining({ upsert: true })
    );
  });

  it('throws what storage refused instead of reporting a silent success', async () => {
    const error = new Error('Payload too large');
    upload.mockResolvedValue({ error });

    await expect(
      uploadJpeg({ bucket: 'avatars', path: 'user-1/avatar.jpg', uri: 'file:///photo.jpg' })
    ).rejects.toBe(error);
  });
});

describe('uploadAvatar', () => {
  it('writes one object per user and returns a URL that busts the CDN cache', async () => {
    const url = await uploadAvatar('user-1', 'file:///photo.jpg');

    expect(buckets).toEqual(['avatars', 'avatars']);
    expect(upload).toHaveBeenCalledWith(
      'user-1/avatar.jpg',
      BYTES,
      expect.objectContaining({ upsert: true })
    );
    // The name never changes, so the URL has to: without the suffix the
    // previous photo stays on screen until the CDN lets go of it.
    expect(url).toBe(`https://cdn/avatars/user-1/avatar.jpg?t=${NOW}`);
  });

  it('does not return a URL when the upload failed', async () => {
    upload.mockResolvedValue({ error: new Error('Storage unreachable') });

    await expect(uploadAvatar('user-1', 'file:///photo.jpg')).rejects.toThrow(
      'Storage unreachable'
    );
  });
});

describe('uploadGroupPhoto', () => {
  it('uses the shared bucket and path, with the same cache-buster', async () => {
    const url = await uploadGroupPhoto('group-1', 'file:///photo.jpg');

    expect(buckets).toEqual([GROUP_PHOTO_BUCKET, GROUP_PHOTO_BUCKET]);
    expect(upload).toHaveBeenCalledWith(
      groupPhotoPath('group-1'),
      BYTES,
      expect.objectContaining({ upsert: true })
    );
    expect(url).toBe(`https://cdn/${GROUP_PHOTO_BUCKET}/${groupPhotoPath('group-1')}?t=${NOW}`);
  });
});
