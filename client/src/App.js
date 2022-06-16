import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Stack,
  Typography,
  TableContainer,
  Table,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { useState, useEffect } from 'react';
import { faRocket } from './icons';
import {
  findIngressesMatchingServices,
  findServicesMatchingDoc,
  sortDocs,
} from './util';

const ERR_KUBECTL_RUNNING = 'Gathering Kubernetes Resources. Please wait...';
const ERR_NOT_ENABLED =
  'Kubernetes is not enabled. To enable it, click the Settings Gear ⚙️ (top right) ➡ Kubernetes ➡ Enable Kubernetes.';

let cliOut = null;
const OUTPUT_WAITING = 'Still waiting on kubectl...';
export function App() {
  const ddClient = createDockerDesktopClient();
  const [docs, setDocs] = useState([]);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState(ERR_KUBECTL_RUNNING);
  const [output, setOutput] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [namespace, setNamespace] = useState('default');
  const [namespaces, setNamespaces] = useState(['default']);

  useEffect(kubectlGetResources, []);
  async function kubectlGetResources(inputText) {
    setTimeout(function () {
      if (cliOut === null) setError(ERR_NOT_ENABLED);
    }, 2500);
    try {
      setOutput(OUTPUT_WAITING);
      cliOut = await ddClient.extension.host.cli.exec(
        'kubectl',
        [
          '--request-timeout 2',
          '--context docker-desktop',
          'get deploy,ing,svc -A',
          '-o json',
          '--field-selector=metadata.namespace!=kube-system',
        ]
          .join(' ')
          .split(' '),
      );
      console.log('CLI Output:', cliOut);
      setOutput(cliOut);
      setError(null);
    } catch (err) {
      setOutput(err);
      console.log('CLI Error:', err);
      if (err.code) setError(ERR_NOT_ENABLED);
      return;
    }
    const parsedDocs = JSON.parse(output.stdout);
    window.docs = parsedDocs.items;
    setDocs(sortDocs(parsedDocs.items));
    const nsSet = [
      ...new Set(parsedDocs.items.map((doc) => doc?.metadata?.namespace)),
    ];
    setNamespaces(nsSet);

    if (nsSet.includes('kubesail-agent')) {
      await waitForAgentReady();
    } else {
      await installKubeSailAgent();
    }
  }

  async function installKubeSailAgent() {
    setToast('Installing KubeSail agent. Please wait...');
    try {
      await ddClient.extension.host.cli.exec('kubectl', [
        'apply',
        ...['-f', 'https://api.kubesail.com/byoc'],
      ]);
    } catch (err) {
      if (err.code) setToast('Error installing KubeSail agent');
      console.log('Error installing KubeSail agent', { err });
      return;
    }
    await waitForAgentReady();
  }

  async function waitForAgentReady() {
    setToast('Waiting for KubeSail agent to start...');
    try {
      await ddClient.extension.host.cli.exec('kubectl', [
        'wait',
        '--for=condition=ready',
        'pod',
        ...['-l', 'app=kubesail-agent'],
        ...['-n', 'kubesail-agent'],
      ]);
    } catch (err) {
      if (err.code) setToast('Error installing KubeSail agent');
      console.log('Error installing KubeSail agent', { err });
      return;
    }
    followAgentLogs();
  }

  function followAgentLogs() {
    ddClient.extension.host.cli.exec(
      'kubectl',
      ['logs', '-n', 'kubesail-agent', '-f', '-l', 'app=kubesail-agent'],
      {
        stream: {
          onOutput(data) {
            const lines = (data.stdout || '').split('\n');
            for (const line of lines) {
              if (line.includes('https://kubesail.com/qr')) {
                const url =
                  line.trim().split(' ').pop() + '?initialID=Docker+Desktop';
                ddClient.host.openExternal(url);
                setToast(
                  <>
                    Finish adding your system at <a href={url}>{url}</a>.
                  </>,
                );
              }

              const claimed = 'Server claimed! ';
              if (line.includes(claimed)) {
                try {
                  const agent = JSON.parse(line.trim().split(claimed).pop());
                  agent.username;
                  setToast(
                    `KubeSail agent is installed and ready! Welcome ${agent.username}!`,
                  );
                } catch {
                  setToast('Error parsing KubeSail agent output');
                }
              }

              if (line.includes('Installing KubeSail Template')) {
                setTimeout(kubectlGetResources, 1000);
              }
            }
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
    // followCmd.end()
  }

  if (error) {
    return (
      <Stack
        display="flex"
        flexGrow={1}
        justifyContent="center"
        alignItems="center"
        padding="40px"
        height="calc(100vh - 80px)"
      >
        <Typography variant="h6" textAlign="center">
          {error}
        </Typography>
        {error === ERR_NOT_ENABLED && (
          <Button
            sx={{ position: 'absolute', bottom: 10, right: 10 }}
            variant="outlined"
            onClick={() => setShowRaw(!showRaw)}
          >
            Toggle Kubectl Output
          </Button>
        )}
        {showRaw && <Typography>{JSON.stringify(output)}</Typography>}
      </Stack>
    );
  }

  const deployments = docs
    .filter((doc) => doc.kind === 'Deployment')
    .filter((doc) => doc?.metadata?.namespace === namespace);

  return (
    <Stack
      display="flex"
      flexGrow={1}
      justifyContent="flex-start"
      alignItems="center"
      padding="20px"
      height="calc(100vh - 60px)"
    >
      {toast && <Typography variant="h6">{toast}</Typography>}
      <FormControl fullWidth margin="20px">
        <InputLabel id="namespace-label">Namespace</InputLabel>
        <Select
          labelId="namespace-label"
          id="namespace"
          value={namespace}
          label="Namespace"
          onChange={(e) => setNamespace(e.target.value)}
        >
          {namespaces.map((ns) => (
            <MenuItem value={ns}>{ns}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <TableContainer>
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
          <TableBody>
            {deployments.map((deploy) => {
              const template =
                deploy?.metadata?.annotations?.['kubesail.com/template'];
              const nsDocs = docs.filter(
                (doc) => doc.metadata.namespace === namespace,
              );
              const services = findServicesMatchingDoc(nsDocs, deploy);
              const ingresses = findIngressesMatchingServices(nsDocs, services);
              const link = ingresses?.[0]?.spec?.rules?.[0]?.host;
              return (
                <TableRow
                  hover
                  key={deploy.metadata.name}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell width="60">
                    {template ? (
                      <img
                        src={`https://api.kubesail.com/template/${template}/icon.png`}
                        height="60"
                        width="60"
                      />
                    ) : (
                      faRocket
                    )}
                  </TableCell>
                  <TableCell align="left">
                    <Typography marginLeft="20px" variant="h5">
                      {deploy?.metadata?.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {link && (
                      <Button
                        variant="outlined"
                        onClick={() =>
                          ddClient.host.openExternal(`https://${link}`)
                        }
                      >
                        Launch
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack direction="row" spacing={2} padding="20px">
        <Button variant="contained" onClick={kubectlGetResources}>
          Refresh
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            ddClient.host.openExternal('https://kubesail.com/templates')
          }
        >
          Get more apps
        </Button>
      </Stack>
    </Stack>
  );
}
