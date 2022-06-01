import { Button, Stack, Typography } from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { useState } from 'react';

export function App() {
  const ddClient = createDockerDesktopClient();
  const [backendInfo, setBackendInfo] = useState();

  async function runExtensionBackend(inputText) {
    await ddClient.extension.host.cli.exec(
      'kubectl',
      ['get', 'pods', '-n', 'kubesail-agent'],
      {
        stream: {
          onOutput(data) {
            // As we can receive both `stdout` and `stderr`, we wrap them in a JSON object
            setBackendInfo('' + data?.stdout + data?.stderr);
            console.log({ stdout: data.stdout, stderr: data.stderr });
          },
          onError(error) {
            console.error(error);
          },
          onClose(exitCode) {
            console.log('onClose with exit code ' + exitCode);
          },
        },
      },
    );
  }

  return (
    <Stack
      display="flex"
      flexGrow={1}
      justifyContent="center"
      alignItems="center"
      height="100vh"
    >
      <Button
        variant="contained"
        onClick={(event) => runExtensionBackend(event.target.value)}
      >
        Kubectl Get Pods
      </Button>

      {backendInfo ? <Typography>{backendInfo}</Typography> : ''}
    </Stack>
  );
}
