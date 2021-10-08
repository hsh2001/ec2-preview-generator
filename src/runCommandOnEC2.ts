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
          [
            // apt 사용 준비
            'sudo apt-get update',

            // apt-get install 시에 에러를 방지하기 위한 설치
            // TODO: 정확히 무슨 문제인지 조사하고 설명하는 주석 추가하기
            'sudo chmod 777 /var/cache/debconf/',
            'sudo chmod 777 /var/cache/debconf/passwords.dat',
            `echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections
            sudo apt-get install -y -q`,

            // nodejs npm libcap2-bin 설치
            // libcap2-bin 은 80번 포트 사용 권한 부여를 위함이다.
            'sudo apt-get install -yq nodejs npm libcap2-bin',

            // nvm 설치하기
            nvmInstallCode,
            'export NVM_DIR="$HOME/.nvm"',
            '[ -s "$NVM_DIR/nvm.sh" ]',
            '. "$NVM_DIR/nvm.sh"',
            '[ -s "$NVM_DIR/bash_completion" ]',
            '. "$NVM_DIR/bash_completion"',

            // nodejs & npm 버전업!
            'nvm install 14.17.5',
            'nvm use 14.17.5',
            'node -v',

            // 깃 클론!!
            `git clone https://${process.env.GITHUB_TOKEN}@github.com/${process.env.GIT_OWNER}/${process.env.GIT_REPO}.git`,
            `cd ${process.env.GIT_REPO}`,
            `git checkout ${process.env.GIT_REF}`,

            // npm 의존설 설치
            'npm i',

            // pm2 설치
            'sudo npm i -g pm2',

            // nodejs 에게 80 포트를 사용할 권한을 주기
            'sudo setcap cap_net_bind_service=+ep `readlink -f \\`which node\\``',

            // 빌드하고 시작!!!
            'npm run build',
            'pm2 run npm -- start',
          ]
            .map((command) => `(\n${command}\n)`)
            .join(' && '),

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
