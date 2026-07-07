/**
 * ==========================================
 * Login
 * ==========================================
 */

const Login = {

    async login(googleIdToken) {

        try {

            const result =
                await API.verify(googleIdToken);

            if (
                result.status !== "success" ||
                !result.user
            ) {

                return null;

            }

            // Simpan user data + token ke session
            // Token dibutuhkan untuk semua request POST berikutnya
            await SessionStorage.save({
                ...result.user,
                token: googleIdToken
            });

            return result.user;

        }

        catch(error){

            console.error(error);

            return null;

        }

    }

};