import { default as axios } from 'axios';
import { Client as SSHClient } from 'ssh2';

export async function runCommandOnEC2(ipAddress: string): Promise<void> {
  const ssh = new SSHClient();

  const { data: nvmInstallCode } = await axios.get(
    'https://raw.githubusercontent.com/nvm-sh/nvm/v0.38.0/install.sh'
  );

  return await new Promise((resolve, reject) => {
    // 한시간동안 실행 안끝나면 에러내기
    const timeout = setTimeout(() => {
      reject('1시간안에 빌드에 성공하지 못했습니다.');
    }, 60 * 60 * 1000);

    ssh
      .on('ready', () => {
        console.log('Client :: ready');
        ssh.exec(
          `
            sudo apt-get update && 
            sudo chmod 777 /var/cache/debconf/ &&
            sudo chmod 777 /var/cache/debconf/passwords.dat &&
            (echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections
            sudo apt-get install -y -q) &&
            sudo apt-get install -yq nodejs npm libcap2-bin &&
            (
              ${nvmInstallCode}
            ) &&
            export NVM_DIR="$HOME/.nvm" &&
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  &&
            [ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"  &&
            nvm install 14.17.5 && nvm use 14.17.5 &&
            node -v &&
            git clone https://${process.env.GITHUB_TOKEN}@github.com/${process.env.GIT_OWNER}/${process.env.GIT_REPO}.git &&
            cd ${process.env.GIT_REPO} &&
            git checkout ${process.env.GIT_REF} &&
            npm i && 
            sudo npm i -g pm2 &&
            npm run build && 
            sudo setcap cap_net_bind_service=+ep \`readlink -f \\\`which node\\\`\` &&
            pm2 start server.js
          `,
          (err, stream) => {
            if (err) return reject(err);

            stream
              .on('close', (code: number, signal: string) => {
                console.log(
                  `Stream :: close :: code: ${code}, signal: ${signal}`
                );

                clearTimeout(timeout);
                ssh.end();

                if (code != 0) {
                  return reject(code);
                }

                resolve();
              })
              .on('data', (data: unknown) => {
                const _data = String(data).trim();
                _data && console.log(`STDOUT: ${_data}`);
              })
              .stderr.on('data', (data) => {
                const errorMessage = String(data).trim();

                if (
                  // 이유는 모르겠지만 깃 클론에서 나오는 메시지를 에러로 판별한다.
                  errorMessage.includes('Cloning into') ||
                  // 이유는 모르겠지만... nvm 다운로드 과정에서 글자가 깨지며 에러가 난다
                  !errorMessage ||
                  errorMessage.length == 1
                ) {
                  return;
                } else {
                  console.log(`STDERR: ${errorMessage}`);
                }
              });
          }
        );
      })
      .connect({
        host: ipAddress,
        port: 22,
        username: 'ubuntu',
        privateKey: process.env.AWS_SSH_KEY,
      });
  });
}
