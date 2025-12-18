import { supabase } from '@/integrations/supabase';

export interface Recording {
  id: string;
  device_id: string;
  user_id: string;
  type: 'video' | 'audio' | 'location' | 'panic';
  file_path?: string;
  location_data?: any;
  duration?: number;
  size?: number;
  created_at: string;
  is_downloaded: boolean;
}

export interface CreateRecordingData {
  device_id: string;
  type: 'video' | 'audio' | 'location' | 'panic';
  file_path?: string;
  location_data?: any;
  duration?: number;
  size?: number;
  blob?: Blob; // Adicionar blob para upload do arquivo real
}

export const useRecordings = () => {
  const getRecordings = async (): Promise<Recording[]> => {
    const { data, error } = await supabase
      .from('recordings')
      .select(`
        *,
        devices (
          id,
          name,
          type
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  };

  const createRecording = async (recordingData: CreateRecordingData): Promise<Recording> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      console.log('👤 Usuário autenticado:', user.id);

      // Gerar nome do arquivo melhorado com timestamp e tipo
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
      const dateStr = now.toLocaleDateString('pt-BR').replace(/\//g, '-');
      const timeStr = now.toLocaleTimeString('pt-BR', { hour12: false }).replace(/:/g, '-');
      
      const fileExt = recordingData.type === 'video' ? 'webm' : 
                     recordingData.type === 'audio' ? 'webm' : 
                     recordingData.type === 'location' ? 'json' : 'webm';
      
      const typeLabel = recordingData.type === 'video' ? 'Video' : 
                       recordingData.type === 'audio' ? 'Audio' : 
                       recordingData.type === 'location' ? 'Localizacao' : 'Panico';
      
      const fileName = `${typeLabel}_${dateStr}_${timeStr}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      console.log('📁 Caminho do arquivo:', filePath);

      // Preparar dados para inserção no banco
      const recordingPayload: any = {
        device_id: recordingData.device_id,
        user_id: user.id,
        type: recordingData.type,
        file_path: filePath,
        duration: recordingData.duration || 0,
        size: recordingData.size || 0,
        is_downloaded: false,
      };

      // Adicionar location_data se for gravação de localização
      if (recordingData.type === 'location' && recordingData.location_data) {
        recordingPayload.location_data = recordingData.location_data;
      }

      // Primeiro, inserir no banco de dados SEM arquivo
      let recordingId: string;
      try {
        const { data, error } = await supabase
          .from('recordings')
          .insert(recordingPayload)
          .select()
          .single();

        if (error) {
          console.error('❌ Erro ao salvar no banco:', error);
          throw error;
        }
        
        console.log('✅ Gravação salva no banco:', data);
        recordingId = data.id;
      } catch (dbError) {
        console.error('❌ Erro crítico ao salvar no banco:', dbError);
        throw dbError;
      }

      // Se há um blob, tentar fazer upload para o Supabase Storage DEPOIS
      if (recordingData.blob) {
        console.log('📤 Tentando upload do arquivo:', filePath, 'Tamanho:', recordingData.blob.size, 'bytes', 'Tipo original:', recordingData.blob.type);
        
        // Determinar contentType correto baseado no tipo de gravação (OBRIGATÓRIO)
        let contentType: string;
        if (recordingData.type === 'video' || recordingData.type === 'panic') {
          contentType = 'video/webm';
        } else if (recordingData.type === 'audio') {
          contentType = 'audio/webm';
        } else if (recordingData.type === 'location') {
          contentType = 'application/json';
        } else {
          contentType = recordingData.blob.type || 'application/octet-stream';
        }

        // SEMPRE recriar o blob com o tipo MIME correto para garantir
        const blobToUpload = new Blob([recordingData.blob], { type: contentType });
        console.log('✅ Blob recriado com tipo MIME correto:', contentType, 'Tamanho:', blobToUpload.size, 'bytes');
        
        try {
          const { error: uploadError } = await supabase.storage
            .from('recordings')
            .upload(filePath, blobToUpload, {
              contentType: contentType, // OBRIGATÓRIO: sempre especificar explicitamente
              upsert: true // Permitir sobrescrever
            });

          if (uploadError) {
            console.error('❌ Erro ao fazer upload:', uploadError);
            // Não falhar - gravação já foi salva no banco
          } else {
            console.log('✅ Upload concluído com sucesso:', filePath, 'ContentType:', contentType);
          }
        } catch (uploadError) {
          console.error('❌ Erro de rede no upload:', uploadError);
          // Não falhar - gravação já foi salva no banco
        }
      } else if (recordingData.type === 'location' && recordingData.location_data) {
        // Para localização, criar blob JSON se não foi fornecido
        console.log('📤 Criando blob JSON para localização');
        const locationBlob = new Blob(
          [JSON.stringify(recordingData.location_data, null, 2)],
          { type: 'application/json' }
        );
        
        try {
          const { error: uploadError } = await supabase.storage
            .from('recordings')
            .upload(filePath, locationBlob, {
              contentType: 'application/json',
              upsert: true
            });

          if (uploadError) {
            console.error('❌ Erro ao fazer upload de localização:', uploadError);
          } else {
            console.log('✅ Upload de localização concluído:', filePath);
          }
        } catch (uploadError) {
          console.error('❌ Erro de rede no upload de localização:', uploadError);
        }
      } else {
        console.log('⚠️ Nenhum blob fornecido para upload');
      }

      // Buscar a gravação criada para retornar
      const { data: createdRecording, error: fetchError } = await supabase
        .from('recordings')
        .select('*')
        .eq('id', recordingId)
        .single();

      if (fetchError) {
        console.error('❌ Erro ao buscar gravação criada:', fetchError);
        throw fetchError;
      }

      console.log('✅ Gravação final criada:', createdRecording);
      return createdRecording;
    } catch (error) {
      console.error('❌ Erro crítico ao criar gravação:', error);
      throw error;
    }
  };

  const updateRecording = async (id: string, updates: Partial<Recording>): Promise<Recording> => {
    const { data, error } = await supabase
      .from('recordings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  };

  const deleteRecording = async (id: string): Promise<void> => {
    const { error } = await supabase
      .from('recordings')
      .delete()
      .eq('id', id);

    if (error) throw error;
  };

  const uploadRecordingFile = async (file: File, recordingId: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const fileExt = file.name.split('.').pop();
    const fileName = `${recordingId}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('recordings')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Update recording with file path
    await updateRecording(recordingId, { file_path: filePath });

    return filePath;
  };

  const downloadRecordingFile = async (filePath: string): Promise<Blob> => {
    const { data, error } = await supabase.storage
      .from('recordings')
      .download(filePath);

    if (error) throw error;
    return data;
  };

  const getRecordingUrl = async (filePath: string): Promise<string> => {
    const { data } = await supabase.storage
      .from('recordings')
      .createSignedUrl(filePath, 3600); // 1 hour

    if (!data) throw new Error('Erro ao gerar URL');
    return data.signedUrl;
  };

  return {
    getRecordings,
    createRecording,
    updateRecording,
    deleteRecording,
    uploadRecordingFile,
    downloadRecordingFile,
    getRecordingUrl,
  };
};
