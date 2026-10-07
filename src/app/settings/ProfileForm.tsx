"use client";

import { useActionState } from "react";
import { profileAction } from "../actions";

export default function ProfileForm({ name }: { name: string }) {
  const [st, act, pending] = useActionState(profileAction, undefined);
  return (
    <form action={act} className="w-profile">
      <label className="fld w-grow">표시 이름<input name="name" className="input" defaultValue={name} maxLength={30} required /></label>
      <button className="btn primary" disabled={pending}>저장</button>
      {st?.error ? <p className="err">{st.error}</p> : st?.ok ? <p className="ok" role="status">저장했어요</p> : null}
    </form>
  );
}
